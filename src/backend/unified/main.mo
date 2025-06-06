import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Blob "mo:base/Blob";
import Region "mo:base/Region";
import Float "mo:base/Float";
import Hash "mo:base/Hash";
import Random "mo:base/Random";
import Char "mo:base/Char";
import Nat32 "mo:base/Nat32";
import Timer "mo:base/Timer";
import Trie "mo:base/Trie";
import Option "mo:base/Option";
import Debug "mo:base/Debug";
import ICRC1 "../../types/icrc1";
import PhotoTypes "../../types/photo";

actor Unified {
    // System configuration
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    
    // Custom hash function for Nat
    private func natHash(n: Nat) : Hash.Hash {
        Text.hash(Nat.toText(n));
    };
    
    // ====================
    // ICRC-1 Token (SPOT)
    // ====================
    private stable var tokenName : Text = "Guess the Spot Token";
    private stable var tokenSymbol : Text = "SPOT";
    private stable var tokenDecimals : Nat8 = 2;
    private stable var tokenTotalSupply : Nat = 0;
    private stable var tokenTransferFee : Nat = 1; // 0.01 SPOT
    
    private var tokenBalances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
    private stable var tokenBalanceEntries : [(Principal, Nat)] = [];
    
    private var tokenAllowances = HashMap.HashMap<(Principal, Principal), Nat>(10, 
        func(a, b) = a.0 == b.0 and a.1 == b.1, 
        func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
    private stable var tokenAllowanceEntries : [((Principal, Principal), Nat)] = [];
    
    private stable var tokenTransactionId : Nat = 0;
    private stable var tokenTotalBurned : Nat = 0;
    
    // ====================
    // ICRC-7 NFT (Photos)
    // ====================
    private stable var nftName : Text = "Guess the Spot Photo NFT";
    private stable var nftSymbol : Text = "GSP";
    private stable var nftTotalSupply : Nat = 0;
    
    public type PhotoMeta = {
        id: Nat;
        owner: Principal;
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        quality: Float;
        uploadTime: Time.Time;
        chunkCount: Nat;
        totalSize: Nat;
        perceptualHash: ?Text;
    };
    
    private var nftOwners = HashMap.HashMap<Nat, Principal>(10, Nat.equal, natHash);
    private stable var nftOwnerEntries : [(Nat, Principal)] = [];
    
    private var photoMetadata = HashMap.HashMap<Nat, PhotoMeta>(10, Nat.equal, natHash);
    private stable var photoMetadataEntries : [(Nat, PhotoMeta)] = [];
    
    private stable var photoRegions : [Region.Region] = [];
    private stable var nextTokenId : Nat = 0;
    
    private let CHUNK_SIZE : Nat = 256 * 1024; // 256KB per chunk
    private let MAX_PHOTO_SIZE : Nat = 5 * 1024 * 1024; // 5MB max
    
    // ====================
    // Game Engine
    // ====================
    public type GameRound = {
        id: Nat;
        photoId: Nat;
        photoMeta: PhotoMeta;
        startTime: Time.Time;
        endTime: ?Time.Time;
        correctLat: Float;
        correctLon: Float;
        totalPlayers: Nat;
        totalRewards: Nat;
    };
    
    public type GameGuess = {
        player: Principal;
        roundId: Nat;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
        distance: Float;
        azimuthError: Float;
        score: Nat;
        reward: Nat;
        timestamp: Time.Time;
    };
    
    private stable var BASE_REWARD : Nat = 100; // 1.00 SPOT (with 2 decimals)
    private stable var UPLOADER_REWARD_RATIO : Float = 0.30; // 30% of player reward
    private stable var totalRoundsPlayed : Nat = 0;
    
    private var activeRounds = HashMap.HashMap<Nat, GameRound>(10, Nat.equal, natHash);
    private var completedRounds = HashMap.HashMap<Nat, GameRound>(10, Nat.equal, natHash);
    private stable var activeRoundEntries : [(Nat, GameRound)] = [];
    private stable var completedRoundEntries : [(Nat, GameRound)] = [];
    private stable var nextRoundId : Nat = 0;
    
    // ====================
    // Reputation Oracle
    // ====================
    public type PhotoReputation = {
        photoId: Nat;
        owner: Principal;
        qualityScore: Float;
        totalGuesses: Nat;
        correctGuesses: Nat;
        reportCount: Nat;
        lastUpdated: Time.Time;
        isBanned: Bool;
    };
    
    public type UserReputation = {
        user: Principal;
        uploaderScore: Float;
        playerScore: Float;
        totalUploads: Nat;
        totalPlays: Nat;
        isBanned: Bool;
        banReason: ?Text;
        lastUpdated: Time.Time;
    };
    
    private let ALPHA : Float = 0.8; // EMA weight for quality score updates
    private let SOFT_BAN_THRESHOLD : Float = 0.15;
    private let HARD_BAN_THRESHOLD : Float = 0.05;
    
    private var photoReputations = HashMap.HashMap<Nat, PhotoReputation>(10, Nat.equal, natHash);
    private var userReputations = HashMap.HashMap<Principal, UserReputation>(10, Principal.equal, Principal.hash);
    private stable var photoReputationEntries : [(Nat, PhotoReputation)] = [];
    private stable var userReputationEntries : [(Principal, UserReputation)] = [];
    
    // ====================
    // System Functions
    // ====================
    system func preupgrade() {
        tokenBalanceEntries := Iter.toArray(tokenBalances.entries());
        tokenAllowanceEntries := Iter.toArray(tokenAllowances.entries());
        nftOwnerEntries := Iter.toArray(nftOwners.entries());
        photoMetadataEntries := Iter.toArray(photoMetadata.entries());
        activeRoundEntries := Iter.toArray(activeRounds.entries());
        completedRoundEntries := Iter.toArray(completedRounds.entries());
        photoReputationEntries := Iter.toArray(photoReputations.entries());
        userReputationEntries := Iter.toArray(userReputations.entries());
        userProfileEntries := Iter.toArray(userProfiles.entries());
        referralCodeEntries := Iter.toArray(referralCodes.entries());
        referralStatEntries := Iter.toArray(referralStats.entries());
        airdropCampaignEntries := Iter.toArray(airdropCampaigns.entries());
        airdropClaimEntries := Iter.toArray(airdropClaims.entries());
        userScheduledCountEntries := Iter.toArray(userScheduledCounts.entries());
    };
    
    system func postupgrade() {
        tokenBalances := HashMap.fromIter<Principal, Nat>(tokenBalanceEntries.vals(), tokenBalanceEntries.size(), Principal.equal, Principal.hash);
        tokenAllowances := HashMap.fromIter<(Principal, Principal), Nat>(tokenAllowanceEntries.vals(), tokenAllowanceEntries.size(), 
            func(a, b) = a.0 == b.0 and a.1 == b.1, 
            func(a) = Principal.hash(a.0) +% Principal.hash(a.1));
        nftOwners := HashMap.fromIter<Nat, Principal>(nftOwnerEntries.vals(), nftOwnerEntries.size(), Nat.equal, natHash);
        photoMetadata := HashMap.fromIter<Nat, PhotoMeta>(photoMetadataEntries.vals(), photoMetadataEntries.size(), Nat.equal, natHash);
        activeRounds := HashMap.fromIter<Nat, GameRound>(activeRoundEntries.vals(), activeRoundEntries.size(), Nat.equal, natHash);
        completedRounds := HashMap.fromIter<Nat, GameRound>(completedRoundEntries.vals(), completedRoundEntries.size(), Nat.equal, natHash);
        photoReputations := HashMap.fromIter<Nat, PhotoReputation>(photoReputationEntries.vals(), photoReputationEntries.size(), Nat.equal, natHash);
        userReputations := HashMap.fromIter<Principal, UserReputation>(userReputationEntries.vals(), userReputationEntries.size(), Principal.equal, Principal.hash);
        userProfiles := HashMap.fromIter<Principal, UserProfile>(userProfileEntries.vals(), userProfileEntries.size(), Principal.equal, Principal.hash);
        referralCodes := HashMap.fromIter<Text, Principal>(referralCodeEntries.vals(), referralCodeEntries.size(), Text.equal, Text.hash);
        referralStats := HashMap.fromIter<Principal, ReferralData>(referralStatEntries.vals(), referralStatEntries.size(), Principal.equal, Principal.hash);
        airdropCampaigns := HashMap.fromIter<Nat, AirdropCampaign>(airdropCampaignEntries.vals(), airdropCampaignEntries.size(), Nat.equal, natHash);
        airdropClaims := HashMap.fromIter<(Principal, Nat), AirdropClaim>(airdropClaimEntries.vals(), airdropClaimEntries.size(),
            func(a, b) = a.0 == b.0 and a.1 == b.1,
            func(a) = Principal.hash(a.0) +% natHash(a.1)
        );
        userScheduledCounts := HashMap.fromIter<Principal, Nat>(userScheduledCountEntries.vals(), userScheduledCountEntries.size(), Principal.equal, Principal.hash);
    };
    
    // Admin function
    public shared(msg) func setOwner(newOwner: Principal) : async Result.Result<Text, Text> {
        if (owner == Principal.fromText("aaaaa-aa")) {
            owner := newOwner;
            #ok("Owner set successfully");
        } else if (msg.caller == owner) {
            owner := newOwner;
            #ok("Owner updated successfully");
        } else {
            #err("Only owner can set new owner");
        };
    };
    
    // ====================
    // Token Functions (ICRC-1)
    // ====================
    private func mint(to: Principal, amount: Nat) : Result.Result<Nat, Text> {
        let currentBalance = switch (tokenBalances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        tokenBalances.put(to, currentBalance + amount);
        tokenTotalSupply += amount;
        tokenTransactionId += 1;
        
        #ok(tokenTransactionId);
    };
    
    public query func icrc1_name() : async Text {
        tokenName;
    };
    
    public query func icrc1_symbol() : async Text {
        tokenSymbol;
    };
    
    public query func icrc1_decimals() : async Nat8 {
        tokenDecimals;
    };
    
    public query func icrc1_fee() : async Nat {
        tokenTransferFee;
    };
    
    public query func icrc1_total_supply() : async Nat {
        tokenTotalSupply;
    };
    
    public query func icrc1_balance_of(account: ICRC1.Account) : async Nat {
        switch (tokenBalances.get(account.owner)) {
            case null { 0 };
            case (?balance) { balance };
        };
    };
    
    public shared(msg) func icrc1_transfer(args: ICRC1.TransferArgs) : async Result.Result<Nat, ICRC1.TransferError> {
        let from = msg.caller;
        let to = args.to.owner;
        let amount = args.amount;
        let fee = switch (args.fee) {
            case null { tokenTransferFee };
            case (?f) { f };
        };
        
        if (fee != tokenTransferFee) {
            return #err(#BadFee { expected_fee = tokenTransferFee });
        };
        
        let fromBalance = switch (tokenBalances.get(from)) {
            case null { 0 };
            case (?balance) { balance };
        };
        
        let totalCost = amount + fee;
        if (fromBalance < totalCost) {
            return #err(#InsufficientFunds { balance = fromBalance });
        };
        
        tokenBalances.put(from, fromBalance - totalCost);
        
        let toBalance = switch (tokenBalances.get(to)) {
            case null { 0 };
            case (?balance) { balance };
        };
        tokenBalances.put(to, toBalance + amount);
        
        tokenTransactionId += 1;
        #ok(tokenTransactionId);
    };
    
    public query func icrc1_metadata() : async [ICRC1.Metadata] {
        [
            { key = "icrc1:name"; value = #Text(tokenName) },
            { key = "icrc1:symbol"; value = #Text(tokenSymbol) },
            { key = "icrc1:decimals"; value = #Nat(Nat8.toNat(tokenDecimals)) },
            { key = "icrc1:fee"; value = #Nat(tokenTransferFee) }
        ];
    };
    
    public query func icrc1_supported_standards() : async [ICRC1.SupportedStandard] {
        [
            { name = "ICRC-1"; url = "https://github.com/dfinity/ICRC-1" },
            { name = "ICRC-2"; url = "https://github.com/dfinity/ICRC-1/blob/main/standards/ICRC-2/README.md" }
        ];
    };
    
    // ====================
    // NFT Functions (ICRC-7)
    // ====================
    // Original mintPhotoNFT is replaced by the enhanced version below
    
    public shared(msg) func uploadPhotoChunk(args: {
        tokenId: Nat;
        chunkIndex: Nat;
        chunkData: Blob;
    }) : async Result.Result<Text, Text> {
        switch (nftOwners.get(args.tokenId)) {
            case null { #err("Token does not exist") };
            case (?tokenOwner) {
                if (tokenOwner != msg.caller) {
                    return #err("Only token owner can upload photo data");
                };
                
                if (args.tokenId >= photoRegions.size()) {
                    return #err("Invalid token ID");
                };
                
                let region = photoRegions[args.tokenId];
                let chunkSize = args.chunkData.size();
                
                if (chunkSize > CHUNK_SIZE) {
                    return #err("Chunk size exceeds maximum allowed");
                };
                
                let offset = Nat64.fromNat(args.chunkIndex * CHUNK_SIZE);
                
                // Grow region if needed
                let requiredPages = Nat64.fromNat((args.chunkIndex + 1) * CHUNK_SIZE / 65536 + 1);
                let currentPages = Region.size(region);
                if (currentPages < requiredPages) {
                    let growAmount = requiredPages - currentPages;
                    let _ = Region.grow(region, growAmount);
                };
                
                Region.storeBlob(region, offset, args.chunkData);
                
                switch (photoMetadata.get(args.tokenId)) {
                    case null { #err("Metadata not found") };
                    case (?meta) {
                        let newTotalSize = meta.totalSize + chunkSize;
                        if (newTotalSize > MAX_PHOTO_SIZE) {
                            return #err("Photo too large: maximum 5MB allowed");
                        };
                        
                        let updatedMeta = {
                            meta with
                            chunkCount = Nat.max(meta.chunkCount, args.chunkIndex + 1);
                            totalSize = newTotalSize;
                        };
                        photoMetadata.put(args.tokenId, updatedMeta);
                        
                        #ok("Chunk uploaded successfully");
                    };
                };
            };
        };
    };
    
    public query func getPhotoChunk(tokenId: Nat, chunkIndex: Nat) : async Result.Result<Blob, Text> {
        if (tokenId >= photoRegions.size()) {
            return #err("Invalid token ID");
        };
        
        switch (photoMetadata.get(tokenId)) {
            case null { #err("Token does not exist") };
            case (?meta) {
                if (chunkIndex >= meta.chunkCount) {
                    return #err("Chunk index out of bounds");
                };
                
                let region = photoRegions[tokenId];
                let offset = Nat64.fromNat(chunkIndex * CHUNK_SIZE);
                
                let isLastChunk = chunkIndex == meta.chunkCount - 1;
                let chunkSize = if (isLastChunk) {
                    meta.totalSize - (chunkIndex * CHUNK_SIZE);
                } else {
                    CHUNK_SIZE;
                };
                
                let chunk = Region.loadBlob(region, offset, chunkSize);
                #ok(chunk);
            };
        };
    };
    
    public query func icrc7_name() : async Text {
        nftName;
    };
    
    public query func icrc7_symbol() : async Text {
        nftSymbol;
    };
    
    public query func icrc7_total_supply() : async Nat {
        nftTotalSupply;
    };
    
    public query func icrc7_owner_of(tokenId: Nat) : async ?Principal {
        nftOwners.get(tokenId);
    };
    
    public query func icrc7_metadata(tokenId: Nat) : async ?PhotoMeta {
        photoMetadata.get(tokenId);
    };
    
    // ====================
    // Game Functions
    // ====================
    public shared(msg) func startNewRound() : async Result.Result<GameRound, Text> {
        // Check user reputation
        switch (userReputations.get(msg.caller)) {
            case (?rep) {
                if (rep.isBanned) {
                    return #err("User is banned");
                };
            };
            case null {};
        };
        
        // Get eligible photos
        let eligiblePhotos = Buffer.Buffer<PhotoMeta>(10);
        for ((tokenId, meta) in photoMetadata.entries()) {
            switch (photoReputations.get(tokenId)) {
                case (?rep) {
                    if (not rep.isBanned and rep.qualityScore >= SOFT_BAN_THRESHOLD and meta.chunkCount > 0) {
                        eligiblePhotos.add(meta);
                    };
                };
                case null {};
            };
        };
        
        if (eligiblePhotos.size() == 0) {
            return #err("No eligible photos available");
        };
        
        // Select random photo
        let seed = await Random.blob();
        let randomBytes = Blob.toArray(seed);
        let randomIndex = Nat8.toNat(randomBytes[0]) % eligiblePhotos.size();
        let selectedPhoto = eligiblePhotos.get(randomIndex);
        
        let roundId = nextRoundId;
        nextRoundId += 1;
        
        let round : GameRound = {
            id = roundId;
            photoId = selectedPhoto.id;
            photoMeta = selectedPhoto;
            startTime = Time.now();
            endTime = null;
            correctLat = selectedPhoto.lat;
            correctLon = selectedPhoto.lon;
            totalPlayers = 0;
            totalRewards = 0;
        };
        
        activeRounds.put(roundId, round);
        totalRoundsPlayed += 1;
        
        #ok(round);
    };
    
    // Original submitGuess is replaced by the enhanced version below
    
    private func calculateDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
        let a : Float = 6378137.0;
        let b : Float = 6356752.314245;
        let f : Float = 1.0 / 298.257223563;
        
        let L = (lon2 - lon1) * Float.pi / 180.0;
        let U1 = Float.arctan((1.0 - f) * Float.tan(lat1 * Float.pi / 180.0));
        let U2 = Float.arctan((1.0 - f) * Float.tan(lat2 * Float.pi / 180.0));
        let sinU1 = Float.sin(U1);
        let cosU1 = Float.cos(U1);
        let sinU2 = Float.sin(U2);
        let cosU2 = Float.cos(U2);
        
        var lambda = L;
        var iterLimit = 100;
        var cosSqAlpha : Float = 0;
        var sinSigma : Float = 0;
        var cos2SigmaM : Float = 0;
        var cosSigma : Float = 0;
        var sigma : Float = 0;
        
        while (iterLimit > 0) {
            let sinLambda = Float.sin(lambda);
            let cosLambda = Float.cos(lambda);
            sinSigma := Float.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * 
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
            
            if (sinSigma == 0.0) { return 0.0 };
            
            cosSigma := sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
            sigma := Float.arctan2(sinSigma, cosSigma);
            let sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
            cosSqAlpha := 1.0 - sinAlpha * sinAlpha;
            cos2SigmaM := cosSigma - 2.0 * sinU1 * sinU2 / cosSqAlpha;
            
            let C = f / 16.0 * cosSqAlpha * (4.0 + f * (4.0 - 3.0 * cosSqAlpha));
            lambda := L + (1.0 - C) * f * sinAlpha * 
                (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * 
                (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM)));
            
            iterLimit -= 1;
        };
        
        if (iterLimit == 0) {
            return -1.0;
        };
        
        let uSq = cosSqAlpha * (a * a - b * b) / (b * b);
        let A = 1.0 + uSq / 16384.0 * (4096.0 + uSq * (-768.0 + uSq * (320.0 - 175.0 * uSq)));
        let B = uSq / 1024.0 * (256.0 + uSq * (-128.0 + uSq * (74.0 - 47.0 * uSq)));
        let deltaSigma = B * sinSigma * (cos2SigmaM + B / 4.0 * (cosSigma * 
            (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM) - B / 6.0 * cos2SigmaM * 
            (-3.0 + 4.0 * sinSigma * sinSigma) * (-3.0 + 4.0 * cos2SigmaM * cos2SigmaM)));
        
        b * A * (sigma - deltaSigma);
    };
    
    private func calculateScore(distance: Float, azimuthError: Float) : Nat {
        if (distance < 25.0) {
            return 100;
        };
        if (distance > 1000.0) {
            return 0;
        };
        
        let Sd = 1.0 - (distance - 25.0) / (1000.0 - 25.0);
        let Sphi = if (azimuthError <= 30.0) {
            1.0 - azimuthError / 30.0;
        } else { 0.0 };
        
        let score = 100.0 * Float.pow(Sd, 1.3) * Float.pow(Sphi, 0.7);
        Int.abs(Float.toInt(score));
    };
    
    private func calculateReward(score: Nat) : Nat {
        BASE_REWARD * score / 100;
    };
    
    // ====================
    // Reputation Functions
    // ====================
    private func updatePhotoReputation(photoId: Nat, score: Nat) {
        switch (photoReputations.get(photoId)) {
            case (?rep) {
                let scoreRatio = Float.fromInt(score) / 100.0;
                let newQualityScore = ALPHA * rep.qualityScore + (1.0 - ALPHA) * scoreRatio;
                
                let updatedRep = {
                    rep with
                    qualityScore = newQualityScore;
                    totalGuesses = rep.totalGuesses + 1;
                    correctGuesses = if (score >= 80) { rep.correctGuesses + 1 } else { rep.correctGuesses };
                    lastUpdated = Time.now();
                    isBanned = newQualityScore < HARD_BAN_THRESHOLD;
                };
                
                photoReputations.put(photoId, updatedRep);
            };
            case null {};
        };
    };
    
    private func updateUserReputation(user: Principal, score: Nat, isUploader: Bool) {
        switch (userReputations.get(user)) {
            case (?rep) {
                let scoreRatio = Float.fromInt(score) / 100.0;
                let updatedRep = if (isUploader) {
                    {
                        rep with
                        uploaderScore = ALPHA * rep.uploaderScore + (1.0 - ALPHA) * scoreRatio;
                        totalUploads = rep.totalUploads + 1;
                        lastUpdated = Time.now();
                    };
                } else {
                    {
                        rep with
                        playerScore = ALPHA * rep.playerScore + (1.0 - ALPHA) * scoreRatio;
                        totalPlays = rep.totalPlays + 1;
                        lastUpdated = Time.now();
                    };
                };
                userReputations.put(user, updatedRep);
            };
            case null {
                let newRep : UserReputation = {
                    user = user;
                    uploaderScore = if (isUploader) { Float.fromInt(score) / 100.0 } else { 1.0 };
                    playerScore = if (not isUploader) { Float.fromInt(score) / 100.0 } else { 1.0 };
                    totalUploads = if (isUploader) { 1 } else { 0 };
                    totalPlays = if (not isUploader) { 1 } else { 0 };
                    isBanned = false;
                    banReason = null;
                    lastUpdated = Time.now();
                };
                userReputations.put(user, newRep);
            };
        };
    };
    
    public query func getPhotoReputation(photoId: Nat) : async ?PhotoReputation {
        photoReputations.get(photoId);
    };
    
    public query func getUserReputation(user: Principal) : async ?UserReputation {
        userReputations.get(user);
    };
    
    // ====================
    // Query Functions
    // ====================
    public query func getActiveRounds() : async [GameRound] {
        Iter.toArray(activeRounds.vals());
    };
    
    public query func getPhotosForGame(excludeOwner: ?Principal, minQuality: Float) : async [PhotoMeta] {
        let photos = Buffer.Buffer<PhotoMeta>(10);
        for ((tokenId, meta) in photoMetadata.entries()) {
            let includePhoto = switch (excludeOwner) {
                case null { true };
                case (?excluded) { meta.owner != excluded };
            };
            
            if (includePhoto and meta.quality >= minQuality and meta.chunkCount > 0) {
                photos.add(meta);
            };
        };
        Buffer.toArray(photos);
    };
    
    public query func getTokensByOwner(owner: Principal) : async [Nat] {
        let tokens = Buffer.Buffer<Nat>(10);
        for ((tokenId, tokenOwner) in nftOwners.entries()) {
            if (tokenOwner == owner) {
                tokens.add(tokenId);
            };
        };
        Buffer.toArray(tokens);
    };
    
    public query func getTotalBurned() : async Nat {
        tokenTotalBurned;
    };
    
    // Leaderboard
    public query func getLeaderboard() : async [(Principal, Nat)] {
        let scores = Buffer.Buffer<(Principal, Nat)>(10);
        for ((user, balance) in tokenBalances.entries()) {
            scores.add((user, balance));
        };
        
        let sorted = Array.sort<(Principal, Nat)>(
            Buffer.toArray(scores),
            func(a, b) = Nat.compare(b.1, a.1)
        );
        
        let limit = 50;
        if (sorted.size() > limit) {
            Array.tabulate<(Principal, Nat)>(limit, func(i) = sorted[i]);
        } else {
            sorted;
        };
    };
    
    // ====================
    // Game Management Functions
    // ====================
    public type RoundResults = {
        roundId: Nat;
        photoId: Nat;
        totalPlayers: Nat;
        topPlayers: [(Principal, Nat)]; // player, score
        avgDistance: Float;
        totalRewards: Nat;
    };
    
    // Store round guesses for results calculation
    private var roundGuesses = HashMap.HashMap<Nat, Buffer.Buffer<GameGuess>>(10, Nat.equal, natHash);
    
    public shared(msg) func endRound(roundId: Nat) : async Result.Result<GameRound, Text> {
        switch (activeRounds.get(roundId)) {
            case null { #err("Round not found") };
            case (?round) {
                // Only owner or round creator can end round
                if (msg.caller != owner) {
                    return #err("Only owner can end rounds");
                };
                
                let endedRound = {
                    round with
                    endTime = ?Time.now();
                };
                
                // Move to completed rounds
                activeRounds.delete(roundId);
                completedRounds.put(roundId, endedRound);
                
                #ok(endedRound);
            };
        };
    };
    
    public query func getRoundResults(roundId: Nat) : async Result.Result<RoundResults, Text> {
        switch (completedRounds.get(roundId)) {
            case null { #err("Round not found or not completed") };
            case (?round) {
                let guesses = switch (roundGuesses.get(roundId)) {
                    case null { Buffer.Buffer<GameGuess>(0) };
                    case (?g) { g };
                };
                
                // Calculate average distance
                var totalDistance = 0.0;
                let guessArray = Buffer.toArray(guesses);
                for (guess in guessArray.vals()) {
                    totalDistance += guess.distance;
                };
                let avgDistance = if (guessArray.size() > 0) {
                    totalDistance / Float.fromInt(guessArray.size());
                } else { 0.0 };
                
                // Get top players
                let sortedGuesses = Array.sort<GameGuess>(
                    guessArray,
                    func(a, b) = Nat.compare(b.score, a.score)
                );
                
                let topLimit = 10;
                let topPlayers = Array.tabulate<(Principal, Nat)>(
                    Nat.min(sortedGuesses.size(), topLimit),
                    func(i) = (sortedGuesses[i].player, sortedGuesses[i].score)
                );
                
                let results : RoundResults = {
                    roundId = roundId;
                    photoId = round.photoId;
                    totalPlayers = round.totalPlayers;
                    topPlayers = topPlayers;
                    avgDistance = avgDistance;
                    totalRewards = round.totalRewards;
                };
                
                #ok(results);
            };
        };
    };
    
    public query func getCompletedRounds(limit: Nat, offset: Nat) : async [GameRound] {
        let rounds = Buffer.Buffer<GameRound>(10);
        for ((_, round) in completedRounds.entries()) {
            rounds.add(round);
        };
        
        // Sort by start time (newest first)
        let sorted = Array.sort<GameRound>(
            Buffer.toArray(rounds),
            func(a, b) = Int.compare(b.startTime, a.startTime)
        );
        
        // Apply pagination
        let start = offset;
        let end = Nat.min(offset + limit, sorted.size());
        
        if (start >= sorted.size()) {
            [];
        } else {
            Array.tabulate<GameRound>(
                end - start,
                func(i) = sorted[start + i]
            );
        };
    };
    
    // ====================
    // Photo Management Functions
    // ====================
    public query func getPhotoMetadataList(limit: Nat, offset: Nat) : async [PhotoMeta] {
        let photos = Buffer.Buffer<PhotoMeta>(10);
        for ((_, meta) in photoMetadata.entries()) {
            photos.add(meta);
        };
        
        // Sort by upload time (newest first)
        let sorted = Array.sort<PhotoMeta>(
            Buffer.toArray(photos),
            func(a, b) = Int.compare(b.uploadTime, a.uploadTime)
        );
        
        // Apply pagination
        let start = offset;
        let end = Nat.min(offset + limit, sorted.size());
        
        if (start >= sorted.size()) {
            [];
        } else {
            Array.tabulate<PhotoMeta>(
                end - start,
                func(i) = sorted[start + i]
            );
        };
    };
    
    public shared(msg) func reportPhoto(photoId: Nat, reason: Text) : async Result.Result<Text, Text> {
        switch (photoReputations.get(photoId)) {
            case null { #err("Photo not found") };
            case (?rep) {
                let updatedRep = {
                    rep with
                    reportCount = rep.reportCount + 1;
                    lastUpdated = Time.now();
                };
                
                photoReputations.put(photoId, updatedRep);
                
                // Auto-ban if too many reports
                if (updatedRep.reportCount >= 5) {
                    let bannedRep = {
                        updatedRep with
                        isBanned = true;
                    };
                    photoReputations.put(photoId, bannedRep);
                };
                
                #ok("Photo reported successfully");
            };
        };
    };
    
    // ====================
    // User Management Functions
    // ====================
    public type UserProfile = {
        principal: Principal;
        username: ?Text;
        avatar: ?Text;
        totalGamesPlayed: Nat;
        totalPhotosUploaded: Nat;
        totalRewardsEarned: Nat;
        bestScore: Nat;
        joinDate: Time.Time;
    };
    
    public type GameHistory = {
        roundId: Nat;
        photoId: Nat;
        score: Nat;
        reward: Nat;
        distance: Float;
        timestamp: Time.Time;
    };
    
    public type UserStats = {
        avgScore: Float;
        avgDistance: Float;
        winRate: Float;
        uploaderRating: Float;
        playerRating: Float;
    };
    
    // Store user profiles
    private var userProfiles = HashMap.HashMap<Principal, UserProfile>(10, Principal.equal, Principal.hash);
    private stable var userProfileEntries : [(Principal, UserProfile)] = [];
    
    // Store game history
    private var userGameHistory = HashMap.HashMap<Principal, Buffer.Buffer<GameHistory>>(10, Principal.equal, Principal.hash);
    
    // ====================
    // Referral System
    // ====================
    public type ReferralData = {
        referrer: ?Principal;
        referredUsers: [Principal];
        totalEarned: Nat;
        tier: Nat; // 0: Bronze, 1: Silver, 2: Gold, 3: Diamond
    };
    
    // Referral configuration
    private stable var REFERRAL_REWARDS = {
        signup = 100; // 1.00 SPOT for signup
        firstUpload = 50; // 0.50 SPOT when referee uploads first photo
        firstPlay = 30; // 0.30 SPOT when referee plays first game
        ongoing = 0.05; // 5% of referee's earnings
    };
    
    private stable var REFERRAL_TIERS = [
        { name = "Bronze"; required = 0; bonus = 1.0 },
        { name = "Silver"; required = 10; bonus = 1.2 },
        { name = "Gold"; required = 50; bonus = 1.5 },
        { name = "Diamond"; required = 100; bonus = 2.0 }
    ];
    
    // Referral storage
    private var referralCodes = HashMap.HashMap<Text, Principal>(10, Text.equal, Text.hash);
    private stable var referralCodeEntries : [(Text, Principal)] = [];
    
    private var referralStats = HashMap.HashMap<Principal, ReferralData>(10, Principal.equal, Principal.hash);
    private stable var referralStatEntries : [(Principal, ReferralData)] = [];
    
    public query func getUserProfile(user: Principal) : async UserProfile {
        switch (userProfiles.get(user)) {
            case null {
                // Return default profile
                {
                    principal = user;
                    username = null;
                    avatar = null;
                    totalGamesPlayed = 0;
                    totalPhotosUploaded = 0;
                    totalRewardsEarned = 0;
                    bestScore = 0;
                    joinDate = Time.now();
                };
            };
            case (?profile) { profile };
        };
    };
    
    public query func getUserGameHistory(user: Principal, limit: Nat) : async [GameHistory] {
        switch (userGameHistory.get(user)) {
            case null { [] };
            case (?history) {
                let historyArray = Buffer.toArray(history);
                let sorted = Array.sort<GameHistory>(
                    historyArray,
                    func(a, b) = Int.compare(b.timestamp, a.timestamp)
                );
                
                if (sorted.size() > limit) {
                    Array.tabulate<GameHistory>(limit, func(i) = sorted[i]);
                } else {
                    sorted;
                };
            };
        };
    };
    
    public query func getUserStatistics(user: Principal) : async UserStats {
        let history = switch (userGameHistory.get(user)) {
            case null { [] };
            case (?h) { Buffer.toArray(h) };
        };
        
        if (history.size() == 0) {
            return {
                avgScore = 0.0;
                avgDistance = 0.0;
                winRate = 0.0;
                uploaderRating = 1.0;
                playerRating = 1.0;
            };
        };
        
        var totalScore = 0;
        var totalDistance = 0.0;
        var wins = 0;
        
        for (game in history.vals()) {
            totalScore += game.score;
            totalDistance += game.distance;
            if (game.score >= 80) { wins += 1 };
        };
        
        let avgScore = Float.fromInt(totalScore) / Float.fromInt(history.size());
        let avgDistance = totalDistance / Float.fromInt(history.size());
        let winRate = Float.fromInt(wins) / Float.fromInt(history.size());
        
        let reputation = switch (userReputations.get(user)) {
            case null { { uploaderScore = 1.0; playerScore = 1.0 } };
            case (?rep) { { uploaderScore = rep.uploaderScore; playerScore = rep.playerScore } };
        };
        
        {
            avgScore = avgScore;
            avgDistance = avgDistance;
            winRate = winRate;
            uploaderRating = reputation.uploaderScore;
            playerRating = reputation.playerScore;
        };
    };
    
    // ====================
    // Token Economics Functions
    // ====================
    private stable var playFee : Nat = 10; // 0.10 SPOT
    private stable var treasuryBalance : Nat = 0;
    private stable var gamePaused : Bool = false;
    private stable var pauseReason : ?Text = null;
    
    public shared(msg) func collectPlayFee() : async Result.Result<Nat, Text> {
        if (gamePaused) {
            return #err("Game is currently paused: " # (switch(pauseReason) { case null { "" }; case (?r) { r } }));
        };
        
        let balance = switch (tokenBalances.get(msg.caller)) {
            case null { 0 };
            case (?b) { b };
        };
        
        if (balance < playFee) {
            return #err("Insufficient balance for play fee");
        };
        
        // Deduct fee from player
        tokenBalances.put(msg.caller, balance - playFee);
        treasuryBalance += playFee;
        
        #ok(playFee);
    };
    
    public shared(msg) func burnTokens(amount: Nat) : async Result.Result<Nat, Text> {
        let balance = switch (tokenBalances.get(msg.caller)) {
            case null { 0 };
            case (?b) { b };
        };
        
        if (balance < amount) {
            return #err("Insufficient balance to burn");
        };
        
        tokenBalances.put(msg.caller, balance - amount);
        tokenTotalSupply -= amount;
        tokenTotalBurned += amount;
        tokenTransactionId += 1;
        
        #ok(tokenTransactionId);
    };
    
    public query func getTreasuryBalance() : async Nat {
        treasuryBalance;
    };
    
    // ====================
    // Admin Functions
    // ====================
    public shared(msg) func setPlayFee(fee: Nat) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set play fee");
        };
        playFee := fee;
        #ok("Play fee updated to " # Nat.toText(fee));
    };
    
    public shared(msg) func setRewardParameters(baseReward: Nat, uploaderRatio: Float) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set reward parameters");
        };
        BASE_REWARD := baseReward;
        UPLOADER_REWARD_RATIO := uploaderRatio;
        #ok("Reward parameters updated");
    };
    
    public shared(msg) func pauseGame(reason: Text) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can pause game");
        };
        gamePaused := true;
        pauseReason := ?reason;
        #ok("Game paused: " # reason);
    };
    
    public shared(msg) func resumeGame() : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can resume game");
        };
        gamePaused := false;
        pauseReason := null;
        #ok("Game resumed");
    };
    
    public shared(msg) func banUser(user: Principal, reason: Text) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can ban users");
        };
        
        let rep = switch (userReputations.get(user)) {
            case null {
                {
                    user = user;
                    uploaderScore = 1.0;
                    playerScore = 1.0;
                    totalUploads = 0;
                    totalPlays = 0;
                    isBanned = true;
                    banReason = ?reason;
                    lastUpdated = Time.now();
                };
            };
            case (?r) {
                {
                    r with
                    isBanned = true;
                    banReason = ?reason;
                    lastUpdated = Time.now();
                };
            };
        };
        
        userReputations.put(user, rep);
        #ok("User banned: " # reason);
    };
    
    // ====================
    // Security Functions
    // ====================
    private var rateLimits = HashMap.HashMap<(Principal, Text), (Nat, Time.Time)>(10,
        func(a, b) = a.0 == b.0 and a.1 == b.1,
        func(a) = Principal.hash(a.0) +% Text.hash(a.1)
    );
    
    private let RATE_LIMIT_WINDOW : Time.Time = 60_000_000_000; // 1 minute
    private let RATE_LIMITS = [
        ("startNewRound", 5), // 5 games per minute
        ("mintPhotoNFT", 3),  // 3 uploads per minute
        ("submitGuess", 10),  // 10 guesses per minute
    ];
    
    public func checkRateLimit(user: Principal, action: Text) : async Result.Result<Bool, Text> {
        let key = (user, action);
        let now = Time.now();
        
        // Find limit for action
        var limit = 0;
        for ((act, lim) in RATE_LIMITS.vals()) {
            if (act == action) {
                limit := lim;
            };
        };
        
        if (limit == 0) {
            return #ok(true); // No limit for this action
        };
        
        switch (rateLimits.get(key)) {
            case null {
                rateLimits.put(key, (1, now));
                #ok(true);
            };
            case (?(count, lastTime)) {
                if (now - lastTime > RATE_LIMIT_WINDOW) {
                    // Reset window
                    rateLimits.put(key, (1, now));
                    #ok(true);
                } else if (count >= limit) {
                    #err("Rate limit exceeded for " # action);
                } else {
                    rateLimits.put(key, (count + 1, lastTime));
                    #ok(true);
                };
            };
        };
    };
    
    // Store perceptual hashes for duplicate detection
    private var perceptualHashes = HashMap.HashMap<Text, Nat>(10, Text.equal, Text.hash);
    
    public func detectDuplicatePhoto(perceptualHash: Text) : async Result.Result<Bool, Text> {
        switch (perceptualHashes.get(perceptualHash)) {
            case null {
                #ok(false); // Not duplicate
            };
            case (?photoId) {
                #ok(true); // Duplicate found
            };
        };
    };
    
    // ====================
    // Referral Functions
    // ====================
    private func generateUniqueCode(user: Principal) : Text {
        let principalText = Principal.toText(user);
        let timestamp = Int.toText(Time.now());
        let combined = principalText # "_" # timestamp;
        
        // Simple hash-like function to create a shorter code
        var code = "";
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var sum = 0;
        
        for (char in combined.chars()) {
            sum += Nat32.toNat(Char.toNat32(char));
        };
        
        // Generate 8-character code
        for (i in Iter.range(0, 7)) {
            let index = (sum + i * 7) % chars.size();
            let char = switch (Text.toArray(chars)[index]) {
                case (?c) { Char.toText(c) };
                case null { "A" };
            };
            code := code # char;
        };
        
        code;
    };
    
    public shared(msg) func generateReferralCode() : async Result.Result<Text, Text> {
        // Check if user already has a code
        for ((code, owner) in referralCodes.entries()) {
            if (owner == msg.caller) {
                return #ok(code);
            };
        };
        
        // Generate new code
        var code = generateUniqueCode(msg.caller);
        var attempts = 0;
        
        // Ensure uniqueness
        while (referralCodes.get(code) != null and attempts < 10) {
            code := generateUniqueCode(msg.caller) # Nat.toText(attempts);
            attempts += 1;
        };
        
        referralCodes.put(code, msg.caller);
        
        // Initialize referral stats if not exists
        switch (referralStats.get(msg.caller)) {
            case null {
                let data : ReferralData = {
                    referrer = null;
                    referredUsers = [];
                    totalEarned = 0;
                    tier = 0;
                };
                referralStats.put(msg.caller, data);
            };
            case (?_) {};
        };
        
        #ok(code);
    };
    
    public shared(msg) func registerWithReferral(referralCode: Text) : async Result.Result<Text, Text> {
        // Check if user already registered
        switch (referralStats.get(msg.caller)) {
            case (?data) {
                if (data.referrer != null) {
                    return #err("User already has a referrer");
                };
            };
            case null {};
        };
        
        // Find referrer
        switch (referralCodes.get(referralCode)) {
            case null { #err("Invalid referral code") };
            case (?referrer) {
                if (referrer == msg.caller) {
                    return #err("Cannot refer yourself");
                };
                
                // Update referee's data
                let refereeData : ReferralData = switch (referralStats.get(msg.caller)) {
                    case null {{
                        referrer = ?referrer;
                        referredUsers = [];
                        totalEarned = 0;
                        tier = 0;
                    }};
                    case (?data) {{
                        data with
                        referrer = ?referrer;
                    }};
                };
                referralStats.put(msg.caller, refereeData);
                
                // Update referrer's data
                switch (referralStats.get(referrer)) {
                    case null {
                        let data : ReferralData = {
                            referrer = null;
                            referredUsers = [msg.caller];
                            totalEarned = 0;
                            tier = 0;
                        };
                        referralStats.put(referrer, data);
                    };
                    case (?data) {
                        let updatedUsers = Array.append(data.referredUsers, [msg.caller]);
                        let newTier = calculateReferralTier(updatedUsers.size());
                        let updatedData = {
                            data with
                            referredUsers = updatedUsers;
                            tier = newTier;
                        };
                        referralStats.put(referrer, updatedData);
                    };
                };
                
                // Mint signup bonus
                switch (mint(referrer, REFERRAL_REWARDS.signup)) {
                    case (#err(e)) { return #err("Failed to mint referral bonus: " # e) };
                    case (#ok(_)) {
                        // Update earnings
                        switch (referralStats.get(referrer)) {
                            case (?data) {
                                let updatedData = {
                                    data with
                                    totalEarned = data.totalEarned + REFERRAL_REWARDS.signup;
                                };
                                referralStats.put(referrer, updatedData);
                            };
                            case null {};
                        };
                    };
                };
                
                #ok("Successfully registered with referral");
            };
        };
    };
    
    private func calculateReferralTier(referralCount: Nat) : Nat {
        var tier = 0;
        for (i in Iter.range(0, REFERRAL_TIERS.size() - 1)) {
            if (referralCount >= REFERRAL_TIERS[i].required) {
                tier := i;
            };
        };
        tier;
    };
    
    public query func getReferralStats(user: Principal) : async ?ReferralData {
        referralStats.get(user);
    };
    
    public query func getReferralCode(user: Principal) : async ?Text {
        for ((code, owner) in referralCodes.entries()) {
            if (owner == user) {
                return ?code;
            };
        };
        null;
    };
    
    public query func getReferralLeaderboard(limit: Nat) : async [(Principal, ReferralData)] {
        let entries = Buffer.Buffer<(Principal, ReferralData)>(10);
        for ((user, data) in referralStats.entries()) {
            entries.add((user, data));
        };
        
        // Sort by total earned
        let sorted = Array.sort<(Principal, ReferralData)>(
            Buffer.toArray(entries),
            func(a, b) = Nat.compare(b.1.totalEarned, a.1.totalEarned)
        );
        
        if (sorted.size() > limit) {
            Array.tabulate<(Principal, ReferralData)>(limit, func(i) = sorted[i]);
        } else {
            sorted;
        };
    };
    
    // Helper function to process referral rewards on game actions
    private func processReferralReward(user: Principal, amount: Nat, rewardType: Text) {
        switch (referralStats.get(user)) {
            case (?userData) {
                switch (userData.referrer) {
                    case (?referrer) {
                        // Calculate referral reward with tier bonus
                        switch (referralStats.get(referrer)) {
                            case (?referrerData) {
                                let tierBonus = REFERRAL_TIERS[referrerData.tier].bonus;
                                let baseReward = if (rewardType == "ongoing") {
                                    Int.abs(Float.toInt(Float.fromInt(amount) * REFERRAL_REWARDS.ongoing));
                                } else if (rewardType == "firstUpload") {
                                    REFERRAL_REWARDS.firstUpload;
                                } else if (rewardType == "firstPlay") {
                                    REFERRAL_REWARDS.firstPlay;
                                } else { 0 };
                                
                                let finalReward = Int.abs(Float.toInt(Float.fromInt(baseReward) * tierBonus));
                                
                                if (finalReward > 0) {
                                    switch (mint(referrer, finalReward)) {
                                        case (#ok(_)) {
                                            let updatedData = {
                                                referrerData with
                                                totalEarned = referrerData.totalEarned + finalReward;
                                            };
                                            referralStats.put(referrer, updatedData);
                                        };
                                        case (#err(_)) {};
                                    };
                                };
                            };
                            case null {};
                        };
                    };
                    case null {};
                };
            };
            case null {};
        };
    };
    
    // ====================
    // Airdrop Campaign Functions
    // ====================
    public type AirdropCampaign = {
        id: Nat;
        name: Text;
        startTime: Time.Time;
        endTime: Time.Time;
        totalTokens: Nat;
        claimedTokens: Nat;
        rewards: {
            signup: Nat;      // Tokens for new users
            firstPhoto: Nat;  // Bonus for first photo upload
            firstPlay: Nat;   // Bonus for first game play
        };
        isActive: Bool;
    };
    
    public type AirdropClaim = {
        user: Principal;
        campaignId: Nat;
        signupBonus: Nat;
        firstPhotoBonus: Nat;
        firstPlayBonus: Nat;
        totalClaimed: Nat;
        claimTime: Time.Time;
    };
    
    // Airdrop storage
    private stable var currentAirdropId : Nat = 0;
    private var airdropCampaigns = HashMap.HashMap<Nat, AirdropCampaign>(10, Nat.equal, natHash);
    private stable var airdropCampaignEntries : [(Nat, AirdropCampaign)] = [];
    
    private var airdropClaims = HashMap.HashMap<(Principal, Nat), AirdropClaim>(10,
        func(a, b) = a.0 == b.0 and a.1 == b.1,
        func(a) = Principal.hash(a.0) +% natHash(a.1)
    );
    private stable var airdropClaimEntries : [((Principal, Nat), AirdropClaim)] = [];
    
    // Early bird bonus tracking
    private stable var earlyBirdCount : Nat = 0;
    private stable var EARLY_BIRD_LIMIT : Nat = 1000;
    
    public shared(msg) func createAirdropCampaign(args: {
        name: Text;
        duration: Time.Time; // Duration in nanoseconds
        totalTokens: Nat;
        signupBonus: Nat;
        firstPhotoBonus: Nat;
        firstPlayBonus: Nat;
    }) : async Result.Result<Nat, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can create airdrop campaigns");
        };
        
        let campaignId = currentAirdropId;
        currentAirdropId += 1;
        
        let campaign : AirdropCampaign = {
            id = campaignId;
            name = args.name;
            startTime = Time.now();
            endTime = Time.now() + args.duration;
            totalTokens = args.totalTokens;
            claimedTokens = 0;
            rewards = {
                signup = args.signupBonus;
                firstPhoto = args.firstPhotoBonus;
                firstPlay = args.firstPlayBonus;
            };
            isActive = true;
        };
        
        airdropCampaigns.put(campaignId, campaign);
        #ok(campaignId);
    };
    
    public shared(msg) func claimAirdropSignupBonus() : async Result.Result<Nat, Text> {
        // Find active campaign
        var activeCampaign : ?AirdropCampaign = null;
        for ((id, campaign) in airdropCampaigns.entries()) {
            if (campaign.isActive and Time.now() <= campaign.endTime) {
                activeCampaign := ?campaign;
            };
        };
        
        switch (activeCampaign) {
            case null { #err("No active airdrop campaign") };
            case (?campaign) {
                let claimKey = (msg.caller, campaign.id);
                
                // Check if already claimed
                switch (airdropClaims.get(claimKey)) {
                    case (?claim) {
                        if (claim.signupBonus > 0) {
                            return #err("Signup bonus already claimed");
                        };
                    };
                    case null {};
                };
                
                // Check if campaign has enough tokens
                if (campaign.claimedTokens + campaign.rewards.signup > campaign.totalTokens) {
                    return #err("Airdrop campaign exhausted");
                };
                
                // Mint signup bonus
                switch (mint(msg.caller, campaign.rewards.signup)) {
                    case (#err(e)) { return #err("Failed to mint airdrop: " # e) };
                    case (#ok(_)) {
                        // Update or create claim record
                        let claim = switch (airdropClaims.get(claimKey)) {
                            case null {{
                                user = msg.caller;
                                campaignId = campaign.id;
                                signupBonus = campaign.rewards.signup;
                                firstPhotoBonus = 0;
                                firstPlayBonus = 0;
                                totalClaimed = campaign.rewards.signup;
                                claimTime = Time.now();
                            }};
                            case (?existing) {{
                                existing with
                                signupBonus = campaign.rewards.signup;
                                totalClaimed = existing.totalClaimed + campaign.rewards.signup;
                            }};
                        };
                        
                        airdropClaims.put(claimKey, claim);
                        
                        // Update campaign
                        let updatedCampaign = {
                            campaign with
                            claimedTokens = campaign.claimedTokens + campaign.rewards.signup;
                        };
                        airdropCampaigns.put(campaign.id, updatedCampaign);
                        
                        // Track early bird
                        if (earlyBirdCount < EARLY_BIRD_LIMIT) {
                            earlyBirdCount += 1;
                        };
                        
                        #ok(campaign.rewards.signup);
                    };
                };
            };
        };
    };
    
    // Process airdrop bonuses for first actions
    private func processAirdropBonus(user: Principal, bonusType: Text) {
        // Find active campaign
        var activeCampaign : ?AirdropCampaign = null;
        for ((id, campaign) in airdropCampaigns.entries()) {
            if (campaign.isActive and Time.now() <= campaign.endTime) {
                activeCampaign := ?campaign;
            };
        };
        
        switch (activeCampaign) {
            case null {};
            case (?campaign) {
                let claimKey = (user, campaign.id);
                let bonusAmount = if (bonusType == "firstPhoto") {
                    campaign.rewards.firstPhoto;
                } else if (bonusType == "firstPlay") {
                    campaign.rewards.firstPlay;
                } else { 0 };
                
                if (bonusAmount == 0) return;
                
                // Check if already claimed this bonus
                switch (airdropClaims.get(claimKey)) {
                    case (?claim) {
                        if (bonusType == "firstPhoto" and claim.firstPhotoBonus > 0) return;
                        if (bonusType == "firstPlay" and claim.firstPlayBonus > 0) return;
                    };
                    case null {};
                };
                
                // Check if campaign has enough tokens
                if (campaign.claimedTokens + bonusAmount <= campaign.totalTokens) {
                    switch (mint(user, bonusAmount)) {
                        case (#ok(_)) {
                            // Update claim record
                            let claim = switch (airdropClaims.get(claimKey)) {
                                case null {{
                                    user = user;
                                    campaignId = campaign.id;
                                    signupBonus = 0;
                                    firstPhotoBonus = if (bonusType == "firstPhoto") { bonusAmount } else { 0 };
                                    firstPlayBonus = if (bonusType == "firstPlay") { bonusAmount } else { 0 };
                                    totalClaimed = bonusAmount;
                                    claimTime = Time.now();
                                }};
                                case (?existing) {{
                                    existing with
                                    firstPhotoBonus = if (bonusType == "firstPhoto") { bonusAmount } else { existing.firstPhotoBonus };
                                    firstPlayBonus = if (bonusType == "firstPlay") { bonusAmount } else { existing.firstPlayBonus };
                                    totalClaimed = existing.totalClaimed + bonusAmount;
                                }};
                            };
                            
                            airdropClaims.put(claimKey, claim);
                            
                            // Update campaign
                            let updatedCampaign = {
                                campaign with
                                claimedTokens = campaign.claimedTokens + bonusAmount;
                            };
                            airdropCampaigns.put(campaign.id, updatedCampaign);
                        };
                        case (#err(_)) {};
                    };
                };
            };
        };
    };
    
    public query func getActiveAirdrop() : async ?AirdropCampaign {
        for ((id, campaign) in airdropCampaigns.entries()) {
            if (campaign.isActive and Time.now() <= campaign.endTime) {
                return ?campaign;
            };
        };
        null;
    };
    
    public query func getAirdropClaim(user: Principal) : async ?AirdropClaim {
        // Find active campaign
        for ((id, campaign) in airdropCampaigns.entries()) {
            if (campaign.isActive) {
                let claimKey = (user, campaign.id);
                switch (airdropClaims.get(claimKey)) {
                    case (?claim) { return ?claim };
                    case null {};
                };
            };
        };
        null;
    };
    
    public query func isEarlyBird(user: Principal) : async Bool {
        // Check if user was in first 1000 to join
        switch (userProfiles.get(user)) {
            case (?profile) {
                // Simple check - could be improved with actual tracking
                earlyBirdCount <= EARLY_BIRD_LIMIT;
            };
            case null { false };
        };
    };
    
    public shared(msg) func endAirdropCampaign(campaignId: Nat) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can end airdrop campaigns");
        };
        
        switch (airdropCampaigns.get(campaignId)) {
            case null { #err("Campaign not found") };
            case (?campaign) {
                let updatedCampaign = {
                    campaign with
                    isActive = false;
                    endTime = Time.now();
                };
                airdropCampaigns.put(campaignId, updatedCampaign);
                #ok("Campaign ended successfully");
            };
        };
    };
    
    // Note: preupgrade/postupgrade functions are already defined above
    
    // Override submitGuess to track history and update profiles
    public shared(msg) func submitGuess(args: {
        roundId: Nat;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
    }) : async Result.Result<GameGuess, Text> {
        // Check rate limit
        switch (await checkRateLimit(msg.caller, "submitGuess")) {
            case (#err(e)) { return #err(e) };
            case (#ok(_)) {};
        };
        
        // Check if game is paused
        if (gamePaused) {
            return #err("Game is currently paused");
        };
        
        switch (activeRounds.get(args.roundId)) {
            case null { #err("Round not found or already completed") };
            case (?round) {
                // Calculate distance and score
                let distance = calculateDistance(round.correctLat, round.correctLon, args.guessLat, args.guessLon);
                let azimuthError = Float.abs(round.photoMeta.azim - args.guessAzim);
                let normalizedAzimuthError = if (azimuthError > 180.0) { 360.0 - azimuthError } else { azimuthError };
                
                let score = calculateScore(distance, normalizedAzimuthError);
                let reward = calculateReward(score);
                
                // Mint rewards
                let playerReward = reward;
                let uploaderReward = Int.abs(Float.toInt(Float.fromInt(reward) * UPLOADER_REWARD_RATIO));
                
                switch (mint(msg.caller, playerReward)) {
                    case (#err(e)) { return #err("Failed to mint player reward: " # e) };
                    case (#ok(_)) {};
                };
                
                switch (mint(round.photoMeta.owner, uploaderReward)) {
                    case (#err(e)) { return #err("Failed to mint uploader reward: " # e) };
                    case (#ok(_)) {};
                };
                
                // Update round
                let updatedRound = {
                    round with
                    totalPlayers = round.totalPlayers + 1;
                    totalRewards = round.totalRewards + playerReward + uploaderReward;
                };
                activeRounds.put(args.roundId, updatedRound);
                
                // Update reputations
                updatePhotoReputation(round.photoId, score);
                updateUserReputation(msg.caller, score, false);
                updateUserReputation(round.photoMeta.owner, score, true);
                
                let guess : GameGuess = {
                    player = msg.caller;
                    roundId = args.roundId;
                    guessLat = args.guessLat;
                    guessLon = args.guessLon;
                    guessAzim = args.guessAzim;
                    distance = distance;
                    azimuthError = normalizedAzimuthError;
                    score = score;
                    reward = playerReward;
                    timestamp = Time.now();
                };
                
                // Store guess for round results
                switch (roundGuesses.get(args.roundId)) {
                    case null {
                        let guesses = Buffer.Buffer<GameGuess>(10);
                        guesses.add(guess);
                        roundGuesses.put(args.roundId, guesses);
                    };
                    case (?guesses) {
                        guesses.add(guess);
                    };
                };
                
                // Update game history
                let history : GameHistory = {
                    roundId = args.roundId;
                    photoId = round.photoId;
                    score = score;
                    reward = playerReward;
                    distance = distance;
                    timestamp = Time.now();
                };
                
                switch (userGameHistory.get(msg.caller)) {
                    case null {
                        let hist = Buffer.Buffer<GameHistory>(10);
                        hist.add(history);
                        userGameHistory.put(msg.caller, hist);
                    };
                    case (?hist) {
                        hist.add(history);
                    };
                };
                
                // Update user profile
                switch (userProfiles.get(msg.caller)) {
                    case null {
                        let profile : UserProfile = {
                            principal = msg.caller;
                            username = null;
                            avatar = null;
                            totalGamesPlayed = 1;
                            totalPhotosUploaded = 0;
                            totalRewardsEarned = playerReward;
                            bestScore = score;
                            joinDate = Time.now();
                        };
                        userProfiles.put(msg.caller, profile);
                        
                        // Process first play referral reward
                        processReferralReward(msg.caller, 0, "firstPlay");
                        
                        // Process first play airdrop bonus
                        processAirdropBonus(msg.caller, "firstPlay");
                    };
                    case (?profile) {
                        let updatedProfile = {
                            profile with
                            totalGamesPlayed = profile.totalGamesPlayed + 1;
                            totalRewardsEarned = profile.totalRewardsEarned + playerReward;
                            bestScore = Nat.max(profile.bestScore, score);
                        };
                        userProfiles.put(msg.caller, updatedProfile);
                        
                        // Process ongoing referral rewards
                        processReferralReward(msg.caller, playerReward, "ongoing");
                    };
                };
                
                #ok(guess);
            };
        };
    };
    
    // Override mintPhotoNFT to update profiles and check duplicates
    public shared(msg) func mintPhotoNFT(args: {
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        perceptualHash: ?Text;
        deviceAttestation: ?Blob;
    }) : async Result.Result<Nat, Text> {
        // Check rate limit
        switch (await checkRateLimit(msg.caller, "mintPhotoNFT")) {
            case (#err(e)) { return #err(e) };
            case (#ok(_)) {};
        };
        
        // Check for duplicate
        switch (args.perceptualHash) {
            case (?hash) {
                switch (await detectDuplicatePhoto(hash)) {
                    case (#ok(true)) { return #err("Duplicate photo detected") };
                    case (#ok(false)) {};
                    case (#err(e)) { return #err(e) };
                };
            };
            case null {};
        };
        
        // Validate coordinates
        if (args.lat < -90.0 or args.lat > 90.0) {
            return #err("Invalid latitude");
        };
        if (args.lon < -180.0 or args.lon > 180.0) {
            return #err("Invalid longitude");
        };
        if (args.azim < 0.0 or args.azim > 360.0) {
            return #err("Invalid azimuth");
        };
        
        let tokenId = nextTokenId;
        nextTokenId += 1;
        
        let metadata : PhotoMeta = {
            id = tokenId;
            owner = msg.caller;
            lat = args.lat;
            lon = args.lon;
            azim = args.azim;
            timestamp = args.timestamp;
            quality = 1.0;
            uploadTime = Time.now();
            chunkCount = 0;
            totalSize = 0;
            perceptualHash = args.perceptualHash;
        };
        
        nftOwners.put(tokenId, msg.caller);
        photoMetadata.put(tokenId, metadata);
        nftTotalSupply += 1;
        
        // Store perceptual hash
        switch (args.perceptualHash) {
            case (?hash) {
                perceptualHashes.put(hash, tokenId);
            };
            case null {};
        };
        
        // Initialize stable memory region
        let region = Region.new();
        let newRegions = Array.tabulate<Region.Region>(tokenId + 1, func(i) {
            if (i < photoRegions.size()) {
                photoRegions[i];
            } else if (i == tokenId) {
                region;
            } else {
                Region.new();
            };
        });
        photoRegions := newRegions;
        
        // Initialize reputation
        let photoRep : PhotoReputation = {
            photoId = tokenId;
            owner = msg.caller;
            qualityScore = 1.0;
            totalGuesses = 0;
            correctGuesses = 0;
            reportCount = 0;
            lastUpdated = Time.now();
            isBanned = false;
        };
        photoReputations.put(tokenId, photoRep);
        
        // Update user profile
        switch (userProfiles.get(msg.caller)) {
            case null {
                let profile : UserProfile = {
                    principal = msg.caller;
                    username = null;
                    avatar = null;
                    totalGamesPlayed = 0;
                    totalPhotosUploaded = 1;
                    totalRewardsEarned = 0;
                    bestScore = 0;
                    joinDate = Time.now();
                };
                userProfiles.put(msg.caller, profile);
                
                // Process first upload referral reward
                processReferralReward(msg.caller, 0, "firstUpload");
                
                // Process first upload airdrop bonus
                processAirdropBonus(msg.caller, "firstPhoto");
            };
            case (?profile) {
                let updatedProfile = {
                    profile with
                    totalPhotosUploaded = profile.totalPhotosUploaded + 1;
                };
                userProfiles.put(msg.caller, updatedProfile);
            };
        };
        
        #ok(tokenId);
    };
    
    // ====================
    // Scheduled Posting System
    // ====================
    
    // Trieのキー生成関数
    private func key(n: Nat) : Trie.Key<Nat> {
        { hash = natHash(n); key = n };
    };
    
    // 予約投稿の保存
    private stable var scheduledPhotos : Trie.Trie<Nat, PhotoTypes.ScheduledPhoto> = Trie.empty();
    private stable var nextScheduledPhotoId : Nat = 0;
    
    // タイマーID管理
    private stable var publishTimers : Trie.Trie<Nat, Timer.TimerId> = Trie.empty();
    
    // ユーザーごとの予約投稿数管理
    private var userScheduledCounts = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
    private stable var userScheduledCountEntries : [(Principal, Nat)] = [];
    
    // 予約投稿の作成
    public shared(msg) func schedulePhotoUpload(request: PhotoTypes.PhotoUploadRequest) : async Result.Result<Nat, Text> {
        let caller = msg.caller;
        
        // 認証チェック
        if (Principal.isAnonymous(caller)) {
            return #err("Anonymous users cannot upload photos");
        };
        
        // ユーザーの予約投稿数チェック
        let currentCount = switch (userScheduledCounts.get(caller)) {
            case null { 0 };
            case (?count) { count };
        };
        
        if (currentCount >= 10) {
            return #err("Maximum 10 scheduled posts per user");
        };
        
        // 予約時間の検証
        switch (request.scheduledPublishTime) {
            case (?scheduledTime) {
                let now = Time.now();
                if (scheduledTime <= now) {
                    return #err("Scheduled time must be in the future");
                };
                
                // 最短5分後
                let minScheduleTime = now + (5 * 60 * 1_000_000_000);
                if (scheduledTime < minScheduleTime) {
                    return #err("Cannot schedule less than 5 minutes in advance");
                };
                
                // 最大予約期間のチェック（30日）
                let maxScheduleTime = now + (30 * 24 * 60 * 60 * 1_000_000_000);
                if (scheduledTime > maxScheduleTime) {
                    return #err("Cannot schedule more than 30 days in advance");
                };
            };
            case null { /* 即時公開 */ };
        };
        
        // 写真IDの生成
        let photoId = nextScheduledPhotoId;
        nextScheduledPhotoId += 1;
        
        // 予約投稿の作成
        let scheduledPhoto : PhotoTypes.ScheduledPhoto = {
            id = photoId;
            photoMeta = request.meta;
            imageChunks = [];
            scheduledPublishTime = Option.get(request.scheduledPublishTime, Time.now());
            status = #pending;
            title = request.title;
            description = request.description;
            difficulty = request.difficulty;
            hint = request.hint;
            tags = request.tags;
            createdAt = Time.now();
            updatedAt = Time.now();
        };
        
        // 保存
        scheduledPhotos := Trie.put(
            scheduledPhotos,
            key(photoId),
            Nat.equal,
            scheduledPhoto
        );
        
        // ユーザーの予約投稿数を更新
        userScheduledCounts.put(caller, currentCount + 1);
        
        // タイマーの設定
        switch (request.scheduledPublishTime) {
            case (?scheduledTime) {
                let delay = Int.abs(scheduledTime - Time.now());
                let timerId = Timer.setTimer(
                    #nanoseconds(delay),
                    func() : async () {
                        await publishScheduledPhoto(photoId);
                    }
                );
                publishTimers := Trie.put(
                    publishTimers,
                    key(photoId),
                    Nat.equal,
                    timerId
                );
            };
            case null {
                // 即時公開
                ignore publishScheduledPhoto(photoId);
            };
        };
        
        #ok(photoId);
    };
    
    // 予約投稿の公開処理
    private func publishScheduledPhoto(photoId: Nat) : async () {
        switch (Trie.get(scheduledPhotos, key(photoId), Nat.equal)) {
            case (?scheduled) {
                if (scheduled.status == #pending) {
                    // NFTとしてミント
                    let mintResult = await mintPhotoNFT({
                        lat = scheduled.photoMeta.lat;
                        lon = scheduled.photoMeta.lon;
                        azim = scheduled.photoMeta.azim;
                        timestamp = scheduled.photoMeta.timestamp;
                        perceptualHash = scheduled.photoMeta.perceptualHash;
                        deviceAttestation = null;
                    });
                    
                    switch (mintResult) {
                        case (#ok(nftId)) {
                            // ステータス更新
                            let updated = {
                                scheduled with
                                status = #published;
                                updatedAt = Time.now();
                            };
                            
                            scheduledPhotos := Trie.put(
                                scheduledPhotos,
                                key(photoId),
                                Nat.equal,
                                updated
                            );
                            
                            // ゲームラウンドに追加
                            ignore createGameRound({
                                photoId = nftId;
                                duration = 3600_000_000_000; // 1時間
                            });
                            
                            // ユーザーの予約投稿数を減らす
                            switch (userScheduledCounts.get(scheduled.photoMeta.owner)) {
                                case (?count) {
                                    if (count > 0) {
                                        userScheduledCounts.put(scheduled.photoMeta.owner, count - 1);
                                    };
                                };
                                case null {};
                            };
                        };
                        case (#err(e)) {
                            // エラーログ（実際の実装では通知システムに送る）
                            Debug.print("Failed to publish scheduled photo: " # e);
                        };
                    };
                    
                    // タイマーのクリーンアップ
                    publishTimers := Trie.remove(publishTimers, key(photoId), Nat.equal);
                };
            };
            case null {};
        };
    };
    
    // 予約投稿のキャンセル
    public shared(msg) func cancelScheduledPhoto(photoId: Nat) : async Result.Result<(), Text> {
        let caller = msg.caller;
        
        switch (Trie.get(scheduledPhotos, key(photoId), Nat.equal)) {
            case (?scheduled) {
                // 所有者チェック
                if (scheduled.photoMeta.owner != caller) {
                    return #err("Not the owner");
                };
                
                if (scheduled.status != #pending) {
                    return #err("Photo already published or cancelled");
                };
                
                // 公開5分前はキャンセル不可
                let now = Time.now();
                let timeTillPublish = scheduled.scheduledPublishTime - now;
                if (timeTillPublish < (5 * 60 * 1_000_000_000)) {
                    return #err("Cannot cancel within 5 minutes of scheduled time");
                };
                
                // タイマーのキャンセル
                switch (Trie.get(publishTimers, key(photoId), Nat.equal)) {
                    case (?timerId) {
                        Timer.cancelTimer(timerId);
                        publishTimers := Trie.remove(publishTimers, key(photoId), Nat.equal);
                    };
                    case null {};
                };
                
                // ステータス更新
                let updated = {
                    scheduled with
                    status = #cancelled;
                    updatedAt = Time.now();
                };
                
                scheduledPhotos := Trie.put(
                    scheduledPhotos,
                    key(photoId),
                    Nat.equal,
                    updated
                );
                
                // ユーザーの予約投稿数を減らす
                switch (userScheduledCounts.get(caller)) {
                    case (?count) {
                        if (count > 0) {
                            userScheduledCounts.put(caller, count - 1);
                        };
                    };
                    case null {};
                };
                
                #ok(());
            };
            case null {
                #err("Scheduled photo not found");
            };
        };
    };
    
    // ユーザーの予約投稿一覧取得
    public query(msg) func getUserScheduledPhotos() : async [PhotoTypes.ScheduledPhoto] {
        let caller = msg.caller;
        let results = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(0);
        
        for ((k, v) in Trie.iter(scheduledPhotos)) {
            if (v.photoMeta.owner == caller and v.status == #pending) {
                results.add(v);
            };
        };
        
        Buffer.toArray(results);
    };
    
    // すべての予約投稿一覧取得（管理者用）
    public query(msg) func getAllScheduledPhotos() : async Result.Result<[PhotoTypes.ScheduledPhoto], Text> {
        if (msg.caller != owner) {
            return #err("Only owner can view all scheduled photos");
        };
        
        let results = Buffer.Buffer<PhotoTypes.ScheduledPhoto>(0);
        
        for ((k, v) in Trie.iter(scheduledPhotos)) {
            if (v.status == #pending) {
                results.add(v);
            };
        };
        
        #ok(Buffer.toArray(results));
    };
    
    // 予約投稿の統計情報取得
    public query func getSchedulingStats() : async PhotoTypes.SchedulingStats {
        var totalScheduled = 0;
        var totalDelay : Nat = 0;
        var cancelledCount = 0;
        let hourCounts = HashMap.HashMap<Nat, Nat>(24, Nat.equal, natHash);
        
        for ((k, v) in Trie.iter(scheduledPhotos)) {
            totalScheduled += 1;
            
            if (v.status == #cancelled) {
                cancelledCount += 1;
            };
            
            // 遅延時間の計算（分単位）
            let delay = Int.abs(v.scheduledPublishTime - v.createdAt) / (60 * 1_000_000_000);
            totalDelay += delay;
            
            // 時間帯別カウント
            let hour = (v.scheduledPublishTime / (60 * 60 * 1_000_000_000)) % 24;
            switch (hourCounts.get(hour)) {
                case null { hourCounts.put(hour, 1); };
                case (?count) { hourCounts.put(hour, count + 1); };
            };
        };
        
        let avgDelay = if (totalScheduled > 0) {
            totalDelay / totalScheduled;
        } else { 0 };
        
        let cancellationRate = if (totalScheduled > 0) {
            Float.fromInt(cancelledCount) / Float.fromInt(totalScheduled);
        } else { 0.0 };
        
        // 時間帯別統計をソート
        let hourStats = Buffer.Buffer<(Nat, Nat)>(0);
        for ((hour, count) in hourCounts.entries()) {
            hourStats.add((hour, count));
        };
        
        {
            totalScheduled = totalScheduled;
            avgScheduleDelay = avgDelay;
            popularScheduleTimes = Buffer.toArray(hourStats);
            cancellationRate = cancellationRate;
        };
    };
}