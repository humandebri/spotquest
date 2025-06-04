import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat16 "mo:base/Nat16";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Region "mo:base/Region";
import Random "mo:base/Random";
import Debug "mo:base/Debug";

// Import types
import Photo "../../types/photo";
import Game "../../types/game";
import ICRC1 "../../types/icrc1";
import ICRC7 "../../types/icrc7";

actor class GuessTheSpot() = self {
    // ===== ASSET SERVING =====
    private type HttpRequest = {
        url: Text;
        method: Text;
        body: Blob;
        headers: [(Text, Text)];
    };
    
    private type HttpResponse = {
        body: Blob;
        headers: [(Text, Text)];
        status_code: Nat16;
    };
    
    private type Asset = {
        content: Blob;
        content_type: Text;
    };
    
    private var assets = HashMap.HashMap<Text, Asset>(10, Text.equal, Text.hash);
    private stable var assetEntries : [(Text, Asset)] = [];
    
    // ===== PHOTO NFT (ICRC-7) =====
    private stable var nftName : Text = "Guess the Spot Photo NFT";
    private stable var nftSymbol : Text = "GSP";
    private stable var nftTotalSupply : Nat = 0;
    private stable var nextTokenId : Nat = 0;
    
    private var nftOwners = HashMap.HashMap<Nat, Principal>(10, Nat.equal, Nat.hash);
    private stable var nftOwnerEntries : [(Nat, Principal)] = [];
    
    private var photoMetadata = HashMap.HashMap<Nat, Photo.PhotoMeta>(10, Nat.equal, Nat.hash);
    private stable var photoMetadataEntries : [(Nat, Photo.PhotoMeta)] = [];
    
    private stable var photoRegions : [Region.Region] = [];
    
    // ===== REWARD TOKEN (ICRC-1) =====
    private stable var tokenName : Text = "Guess the Spot Token";
    private stable var tokenSymbol : Text = "SPOT";
    private stable var tokenDecimals : Nat8 = 2;
    private stable var tokenTotalSupply : Nat = 0;
    
    private var balances = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
    private stable var balanceEntries : [(Principal, Nat)] = [];
    
    private var allowances = HashMap.HashMap<Principal, HashMap.HashMap<Principal, Nat>>(10, Principal.equal, Principal.hash);
    private stable var allowanceEntries : [(Principal, [(Principal, Nat)])] = [];
    
    // ===== GAME ENGINE =====
    private stable var gameEngineOwner : Principal = Principal.fromText("aaaaa-aa");
    private stable var admin : Principal = Principal.fromText("aaaaa-aa");
    private stable var PLAY_FEE : Nat = 1;
    private stable var ROUND_DURATION : Time.Time = 300_000_000_000;
    private stable var MIN_QUALITY_FOR_GAME : Float = 0.3;
    private stable var totalRoundsPlayed : Nat = 0;
    private stable var nextRoundId : Nat = 0;
    
    private var activeRounds = HashMap.HashMap<Nat, Game.GameRound>(10, Nat.equal, Nat.hash);
    private var completedRounds = HashMap.HashMap<Nat, Game.GameRound>(10, Nat.equal, Nat.hash);
    private stable var activeRoundEntries : [(Nat, Game.GameRound)] = [];
    private stable var completedRoundEntries : [(Nat, Game.GameRound)] = [];
    
    private var prng : ?Random.Finite = null;
    
    // ===== REPUTATION ORACLE =====
    private var photoReputation = HashMap.HashMap<Nat, Photo.ReputationData>(10, Nat.equal, Nat.hash);
    private stable var photoReputationEntries : [(Nat, Photo.ReputationData)] = [];
    
    // ===== CONSTANTS =====
    private let CHUNK_SIZE : Nat = 256 * 1024;
    private let MAX_PHOTO_SIZE : Nat = 5 * 1024 * 1024;
    
    // ===== HTTP INTERFACE =====
    public query func http_request(request: HttpRequest) : async HttpResponse {
        let path = if (request.url == "/") { "/index.html" } else { request.url };
        
        switch (assets.get(path)) {
            case null {
                {
                    body = Text.encodeUtf8("404 Not Found");
                    headers = [("Content-Type", "text/plain")];
                    status_code = 404;
                };
            };
            case (?asset) {
                {
                    body = asset.content;
                    headers = [
                        ("Content-Type", asset.content_type),
                        ("Cache-Control", "public, max-age=31536000"),
                        ("Access-Control-Allow-Origin", "*")
                    ];
                    status_code = 200;
                };
            };
        };
    };
    
    public func http_request_update(request: HttpRequest) : async HttpResponse {
        http_request(request);
    };
    
    // ===== PHOTO NFT FUNCTIONS =====
    public shared(msg) func mintPhotoNFT(args: {
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        perceptualHash: ?Text;
        deviceAttestation: ?Blob;
    }) : async Result.Result<Nat, Text> {
        // Validate coordinates
        if (args.lat < -90 or args.lat > 90) {
            return #err("Invalid latitude");
        };
        if (args.lon < -180 or args.lon > 180) {
            return #err("Invalid longitude");
        };
        if (args.azim < 0 or args.azim > 360) {
            return #err("Invalid azimuth");
        };
        
        let tokenId = nextTokenId;
        nextTokenId += 1;
        
        let metadata : Photo.PhotoMeta = {
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
        
        #ok(tokenId);
    };
    
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
                let requiredPages = (args.chunkIndex + 1) * CHUNK_SIZE / 65536 + 1;
                let currentPages = Region.size(region);
                if (currentPages < requiredPages) {
                    let _ = Region.grow(region, requiredPages - currentPages);
                };
                
                Region.storeBlob(region, offset, args.chunkData);
                
                switch (photoMetadata.get(args.tokenId)) {
                    case null { #err("Metadata not found") };
                    case (?meta) {
                        let newTotalSize = meta.totalSize + chunkSize;
                        if (newTotalSize > MAX_PHOTO_SIZE) {
                            return #err("Photo size exceeds maximum allowed");
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
    
    // ===== GAME ENGINE FUNCTIONS =====
    public shared(msg) func createRound() : async Result.Result<Nat, Text> {
        let photos = getPhotosForGame(?msg.caller, MIN_QUALITY_FOR_GAME);
        
        if (photos.size() == 0) {
            return #err("No eligible photos available for game");
        };
        
        let seed = await Random.blob();
        prng := ?Random.Finite(seed);
        
        switch (prng) {
            case null { #err("Failed to initialize random number generator") };
            case (?rng) {
                let randomIndex = switch (rng.byte()) {
                    case null { 0 };
                    case (?byte) { Nat8.toNat(byte) % photos.size() };
                };
                
                let selectedPhoto = photos[randomIndex];
                
                let round : Game.GameRound = {
                    id = nextRoundId;
                    photoId = selectedPhoto.id;
                    photoMeta = selectedPhoto;
                    startTime = Time.now();
                    endTime = null;
                    participants = [msg.caller];
                    submissions = [];
                    settled = false;
                };
                
                activeRounds.put(nextRoundId, round);
                nextRoundId += 1;
                totalRoundsPlayed += 1;
                
                #ok(round.id);
            };
        };
    };
    
    public shared(msg) func submitGuess(args: {
        roundId: Nat;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
    }) : async Result.Result<Text, Text> {
        switch (activeRounds.get(args.roundId)) {
            case null { #err("Round not found or already ended") };
            case (?round) {
                let currentTime = Time.now();
                if (currentTime - round.startTime > ROUND_DURATION) {
                    return #err("Round has ended");
                };
                
                for (submission in round.submissions.vals()) {
                    if (submission.player == msg.caller) {
                        return #err("Already submitted guess for this round");
                    };
                };
                
                let distance = calculateDistance(
                    round.photoMeta.lat,
                    round.photoMeta.lon,
                    args.guessLat,
                    args.guessLon
                );
                
                let azimuthError = calculateAzimuthError(
                    round.photoMeta.azim,
                    args.guessAzim
                );
                
                let score = calculateScore(distance, azimuthError);
                let reward = calculateReward(score);
                
                let submission : Game.Submission = {
                    player = msg.caller;
                    guessLat = args.guessLat;
                    guessLon = args.guessLon;
                    guessAzim = args.guessAzim;
                    submissionTime = currentTime;
                    distance = ?distance;
                    azimuthError = ?azimuthError;
                    score = ?score;
                    reward = ?reward;
                };
                
                let updatedSubmissions = Array.append(round.submissions, [submission]);
                let updatedRound = {
                    round with
                    submissions = updatedSubmissions;
                };
                
                activeRounds.put(args.roundId, updatedRound);
                
                #ok("Guess submitted successfully. Score: " # Nat.toText(score));
            };
        };
    };
    
    // ===== ICRC-1 TOKEN FUNCTIONS =====
    public query func icrc1_name() : async Text { tokenName };
    public query func icrc1_symbol() : async Text { tokenSymbol };
    public query func icrc1_decimals() : async Nat8 { tokenDecimals };
    public query func icrc1_total_supply() : async Nat { tokenTotalSupply };
    
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
        
        switch (balances.get(from)) {
            case null { #err(#InsufficientBalance) };
            case (?fromBalance) {
                if (fromBalance < amount) {
                    return #err(#InsufficientBalance);
                };
                
                let newFromBalance = fromBalance - amount;
                let newToBalance = switch (balances.get(to)) {
                    case null { amount };
                    case (?toBalance) { toBalance + amount };
                };
                
                balances.put(from, newFromBalance);
                balances.put(to, newToBalance);
                
                #ok(1); // Transaction ID
            };
        };
    };
    
    // ===== ICRC-7 NFT FUNCTIONS =====
    public query func icrc7_name() : async Text { nftName };
    public query func icrc7_symbol() : async Text { nftSymbol };
    public query func icrc7_total_supply() : async Nat { nftTotalSupply };
    
    public query func icrc7_balance_of(account: Principal) : async Nat {
        var balance = 0;
        for ((tokenId, owner) in nftOwners.entries()) {
            if (owner == account) {
                balance += 1;
            };
        };
        balance;
    };
    
    public query func icrc7_owner_of(tokenId: Nat) : async ?Principal {
        nftOwners.get(tokenId);
    };
    
    // ===== HELPER FUNCTIONS =====
    private func calculateDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
        // Simplified distance calculation
        let R = 6371000.0; // Earth radius in meters
        let phi1 = lat1 * Float.pi / 180.0;
        let phi2 = lat2 * Float.pi / 180.0;
        let deltaPhi = (lat2 - lat1) * Float.pi / 180.0;
        let deltaLambda = (lon2 - lon1) * Float.pi / 180.0;
        
        let a = Float.sin(deltaPhi/2) * Float.sin(deltaPhi/2) +
                Float.cos(phi1) * Float.cos(phi2) *
                Float.sin(deltaLambda/2) * Float.sin(deltaLambda/2);
        let c = 2 * Float.arctan2(Float.sqrt(a), Float.sqrt(1-a));
        
        R * c;
    };
    
    private func calculateAzimuthError(azim1: Float, azim2: Float) : Float {
        var diff = Float.abs(azim1 - azim2);
        if (diff > 180.0) {
            diff := 360.0 - diff;
        };
        diff;
    };
    
    private func calculateScore(distance: Float, azimuthError: Float) : Nat {
        let R_FULL = 25.0;
        let R_ZERO = 1000.0;
        let THETA_MAX = 30.0;
        let GAMMA = 1.3;
        let DELTA = 0.7;
        let S_MAX = 100.0;
        
        let Sd = if (distance <= R_FULL) {
            1.0;
        } else if (distance >= R_ZERO) {
            0.0;
        } else {
            1.0 - (distance - R_FULL) / (R_ZERO - R_FULL);
        };
        
        let Sphi = if (azimuthError >= THETA_MAX) {
            0.0;
        } else {
            1.0 - azimuthError / THETA_MAX;
        };
        
        let score = S_MAX * (Sd ** GAMMA) * (Sphi ** DELTA);
        Int.abs(Float.toInt(score));
    };
    
    private func calculateReward(score: Nat) : Nat {
        let BASE_REWARD_MULTIPLIER = 0.02;
        let decayFactor = 1.0 / (1.0 + 0.05 * Float.fromInt(totalRoundsPlayed));
        let reward = Float.fromInt(score) * BASE_REWARD_MULTIPLIER * decayFactor;
        Int.abs(Float.toInt(reward * 100.0));
    };
    
    private func getPhotosForGame(excludeOwner: ?Principal, minQuality: Float) : [Photo.PhotoMeta] {
        let photos = Buffer.Buffer<Photo.PhotoMeta>(10);
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
    
    // ===== ADMIN FUNCTIONS =====
    public shared(msg) func setAdmin(newAdmin: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != admin) {
            return #err("Only admin can change admin");
        };
        admin := newAdmin;
        #ok("Admin updated successfully");
    };
    
    public query func getAdmin() : async Principal {
        admin;
    };
    
    // ===== ASSET MANAGEMENT =====
    public shared(msg) func upload_asset(args: {
        path: Text;
        content: Blob;
        content_type: Text;
    }) : async Result.Result<Text, Text> {
        if (msg.caller != admin) {
            return #err("Unauthorized");
        };
        
        assets.put(args.path, {
            content = args.content;
            content_type = args.content_type;
        });
        
        #ok("Asset uploaded successfully");
    };
    
    public shared(msg) func delete_asset(path: Text) : async Result.Result<Text, Text> {
        if (msg.caller != admin) {
            return #err("Unauthorized");
        };
        
        switch (assets.remove(path)) {
            case null { #err("Asset not found") };
            case (?_) { #ok("Asset deleted successfully") };
        };
    };
    
    // ===== SYSTEM FUNCTIONS =====
    system func preupgrade() {
        assetEntries := Iter.toArray(assets.entries());
        nftOwnerEntries := Iter.toArray(nftOwners.entries());
        photoMetadataEntries := Iter.toArray(photoMetadata.entries());
        balanceEntries := Iter.toArray(balances.entries());
        activeRoundEntries := Iter.toArray(activeRounds.entries());
        completedRoundEntries := Iter.toArray(completedRounds.entries());
        photoReputationEntries := Iter.toArray(photoReputation.entries());
        
        // Save allowances
        let allowanceBuffer = Buffer.Buffer<(Principal, [(Principal, Nat)])>(10);
        for ((owner, spenderMap) in allowances.entries()) {
            let spenders = Iter.toArray(spenderMap.entries());
            allowanceBuffer.add((owner, spenders));
        };
        allowanceEntries := Buffer.toArray(allowanceBuffer);
    };
    
    system func postupgrade() {
        assets := HashMap.fromIter<Text, Asset>(assetEntries.vals(), assetEntries.size(), Text.equal, Text.hash);
        nftOwners := HashMap.fromIter<Nat, Principal>(nftOwnerEntries.vals(), nftOwnerEntries.size(), Nat.equal, Nat.hash);
        photoMetadata := HashMap.fromIter<Nat, Photo.PhotoMeta>(photoMetadataEntries.vals(), photoMetadataEntries.size(), Nat.equal, Nat.hash);
        balances := HashMap.fromIter<Principal, Nat>(balanceEntries.vals(), balanceEntries.size(), Principal.equal, Principal.hash);
        activeRounds := HashMap.fromIter<Nat, Game.GameRound>(activeRoundEntries.vals(), activeRoundEntries.size(), Nat.equal, Nat.hash);
        completedRounds := HashMap.fromIter<Nat, Game.GameRound>(completedRoundEntries.vals(), completedRoundEntries.size(), Nat.equal, Nat.hash);
        photoReputation := HashMap.fromIter<Nat, Photo.ReputationData>(photoReputationEntries.vals(), photoReputationEntries.size(), Nat.equal, Nat.hash);
        
        // Restore allowances
        allowances := HashMap.HashMap<Principal, HashMap.HashMap<Principal, Nat>>(10, Principal.equal, Principal.hash);
        for ((owner, spenders) in allowanceEntries.vals()) {
            let spenderMap = HashMap.fromIter<Principal, Nat>(spenders.vals(), spenders.size(), Principal.equal, Principal.hash);
            allowances.put(owner, spenderMap);
        };
    };
}