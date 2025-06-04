import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import Region "mo:base/Region";
import Float "mo:base/Float";
import Validation "./validation";

actor PhotoNFT {
    // NFT metadata
    private stable var name : Text = "Guess the Spot Photo NFT";
    private stable var symbol : Text = "GSP";
    private stable var totalSupply : Nat = 0;
    
    // Owner management
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    private stable var gameEngineCanisterId : ?Principal = null;
    
    // Photo metadata structure
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
    
    // NFT ownership mapping
    private var owners = HashMap.HashMap<Nat, Principal>(10, Nat.equal, Nat.hash);
    private stable var ownerEntries : [(Nat, Principal)] = [];
    
    // Photo metadata storage
    private var photoMetadata = HashMap.HashMap<Nat, PhotoMeta>(10, Nat.equal, Nat.hash);
    private stable var photoMetadataEntries : [(Nat, PhotoMeta)] = [];
    
    // Stable memory regions for photo storage
    private stable var photoRegions : [Region.Region] = [];
    private stable var nextTokenId : Nat = 0;
    
    // Constants
    private let CHUNK_SIZE : Nat = 256 * 1024; // 256KB per chunk
    private let MAX_PHOTO_SIZE : Nat = 5 * 1024 * 1024; // 5MB max
    
    system func preupgrade() {
        ownerEntries := Iter.toArray(owners.entries());
        photoMetadataEntries := Iter.toArray(photoMetadata.entries());
    };
    
    system func postupgrade() {
        owners := HashMap.fromIter<Nat, Principal>(ownerEntries.vals(), ownerEntries.size(), Nat.equal, Nat.hash);
        photoMetadata := HashMap.fromIter<Nat, PhotoMeta>(photoMetadataEntries.vals(), photoMetadataEntries.size(), Nat.equal, Nat.hash);
    };
    
    // Set game engine canister (owner only)
    public shared(msg) func setGameEngineCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set game engine canister");
        };
        gameEngineCanisterId := ?canisterId;
        #ok("Game engine canister set successfully");
    };
    
    // Mint new photo NFT with validation
    public shared(msg) func mintPhotoNFT(args: {
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        perceptualHash: ?Text;
        deviceAttestation: ?Blob;
    }) : async Result.Result<Nat, Text> {
        // Validate GPS coordinates
        switch (Validation.validateGPSCoordinates(args.lat, args.lon)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate azimuth
        switch (Validation.validateAzimuth(args.azim)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate timestamp
        switch (Validation.validateTimestamp(args.timestamp)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate device attestation if provided
        switch (args.deviceAttestation) {
            case null {};
            case (?attestation) {
                switch (Validation.validateDeviceAttestation(attestation)) {
                    case (#err(e)) { return #err(e) };
                    case (#ok()) {};
                };
            };
        };
        let tokenId = nextTokenId;
        nextTokenId += 1;
        
        // Create metadata
        let metadata : PhotoMeta = {
            id = tokenId;
            owner = msg.caller;
            lat = args.lat;
            lon = args.lon;
            azim = args.azim;
            timestamp = args.timestamp;
            quality = 1.0; // Initial quality score
            uploadTime = Time.now();
            chunkCount = 0; // Will be updated when chunks are uploaded
            totalSize = 0;
            perceptualHash = args.perceptualHash;
        };
        
        // Store ownership and metadata
        owners.put(tokenId, msg.caller);
        photoMetadata.put(tokenId, metadata);
        totalSupply += 1;
        
        // Initialize stable memory region for this photo
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
    
    // Upload photo chunk
    public shared(msg) func uploadPhotoChunk(args: {
        tokenId: Nat;
        chunkIndex: Nat;
        chunkData: Blob;
    }) : async Result.Result<Text, Text> {
        // Verify ownership
        switch (owners.get(args.tokenId)) {
            case null { #err("Token does not exist") };
            case (?tokenOwner) {
                if (tokenOwner != msg.caller) {
                    return #err("Only token owner can upload photo data");
                };
                
                // Verify token ID is within bounds
                if (args.tokenId >= photoRegions.size()) {
                    return #err("Invalid token ID");
                };
                
                let region = photoRegions[args.tokenId];
                let chunkSize = args.chunkData.size();
                
                // Validate chunk data
                if (args.chunkIndex == 0) {
                    // First chunk - validate image format
                    switch (Validation.detectImageFormat(args.chunkData)) {
                        case null { return #err("Invalid or unsupported image format") };
                        case (?format) {};
                    };
                };
                
                // Verify chunk size
                if (chunkSize > CHUNK_SIZE) {
                    return #err("Chunk size exceeds maximum allowed");
                };
                
                // Calculate offset for this chunk
                let offset = Nat64.fromNat(args.chunkIndex * CHUNK_SIZE);
                
                // Grow region if needed
                let requiredPages = (args.chunkIndex + 1) * CHUNK_SIZE / 65536 + 1;
                let currentPages = Region.size(region);
                if (currentPages < requiredPages) {
                    let _ = Region.grow(region, requiredPages - currentPages);
                };
                
                // Store chunk data
                Region.storeBlob(region, offset, args.chunkData);
                
                // Update metadata
                switch (photoMetadata.get(args.tokenId)) {
                    case null { #err("Metadata not found") };
                    case (?meta) {
                        let newTotalSize = meta.totalSize + chunkSize;
                        
                        // Validate total size
                        switch (Validation.validatePhotoSize(newTotalSize)) {
                            case (#err(e)) { return #err(e) };
                            case (#ok()) {};
                        };
                        
                        let updatedMeta = {
                            meta with
                            chunkCount = Nat.max(meta.chunkCount, args.chunkIndex + 1);
                            totalSize = newTotalSize;
                        };
                        photoMetadata.put(args.tokenId, updatedMeta);
                        
                        // If this is the last chunk, calculate perceptual hash if not provided
                        if (args.chunkIndex + 1 == updatedMeta.chunkCount and updatedMeta.perceptualHash == null) {
                            // TODO: Reconstruct full image and calculate hash
                            // For now, we'll use the hash from minting
                        };
                        
                        #ok("Chunk uploaded successfully");
                    };
                };
            };
        };
    };
    
    // Get photo chunk
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
                
                // Calculate actual chunk size (last chunk might be smaller)
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
    
    // Update photo quality score (ReputationOracle only)
    public shared(msg) func updateQualityScore(tokenId: Nat, newScore: Float) : async Result.Result<Text, Text> {
        // TODO: Add ReputationOracle canister ID check
        switch (photoMetadata.get(tokenId)) {
            case null { #err("Token does not exist") };
            case (?meta) {
                let updatedMeta = {
                    meta with quality = newScore;
                };
                photoMetadata.put(tokenId, updatedMeta);
                #ok("Quality score updated");
            };
        };
    };
    
    // ICRC-7 standard functions
    public query func icrc7_name() : async Text {
        name;
    };
    
    public query func icrc7_symbol() : async Text {
        symbol;
    };
    
    public query func icrc7_total_supply() : async Nat {
        totalSupply;
    };
    
    public query func icrc7_balance_of(account: Principal) : async Nat {
        var balance = 0;
        for ((tokenId, owner) in owners.entries()) {
            if (owner == account) {
                balance += 1;
            };
        };
        balance;
    };
    
    public query func icrc7_owner_of(tokenId: Nat) : async ?Principal {
        owners.get(tokenId);
    };
    
    public query func icrc7_metadata(tokenId: Nat) : async ?PhotoMeta {
        photoMetadata.get(tokenId);
    };
    
    // Transfer NFT
    public shared(msg) func icrc7_transfer(args: { to: Principal; tokenId: Nat }) : async Result.Result<Nat, Text> {
        switch (owners.get(args.tokenId)) {
            case null { #err("Token does not exist") };
            case (?tokenOwner) {
                if (tokenOwner != msg.caller) {
                    return #err("Only token owner can transfer");
                };
                
                owners.put(args.tokenId, args.to);
                
                // Update metadata owner
                switch (photoMetadata.get(args.tokenId)) {
                    case null { #err("Metadata not found") };
                    case (?meta) {
                        let updatedMeta = {
                            meta with owner = args.to;
                        };
                        photoMetadata.put(args.tokenId, updatedMeta);
                        #ok(args.tokenId);
                    };
                };
            };
        };
    };
    
    // Get tokens by owner
    public query func getTokensByOwner(owner: Principal) : async [Nat] {
        let tokens = Buffer.Buffer<Nat>(10);
        for ((tokenId, tokenOwner) in owners.entries()) {
            if (tokenOwner == owner) {
                tokens.add(tokenId);
            };
        };
        Buffer.toArray(tokens);
    };
    
    // Get photo metadata for game selection
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
}