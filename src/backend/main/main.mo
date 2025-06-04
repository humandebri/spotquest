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
import Int "mo:base/Int";
import Float "mo:base/Float";

// Import other canisters as modules
import PhotoNFT "../photo_nft/main";
import GameEngine "../game_engine/main";
import RewardMint "../reward_mint/main";
import ReputationOracle "../reputation_oracle/main";

// Import asset handling
import Assets "./assets";

actor Main {
    // Initialize sub-modules
    private stable var photoNFT = PhotoNFT.PhotoNFT();
    private stable var gameEngine = GameEngine.GameEngine();
    private stable var rewardMint = RewardMint.RewardMint();
    private stable var reputationOracle = ReputationOracle.ReputationOracle();
    
    // Asset storage
    private var assets = Assets.Assets();
    
    // HTTP interface for serving frontend
    public query func http_request(request: Assets.HttpRequest) : async Assets.HttpResponse {
        assets.http_request(request)
    };
    
    public func http_request_update(request: Assets.HttpRequest) : async Assets.HttpResponse {
        assets.http_request_update(request)
    };
    
    // Forward PhotoNFT calls
    public shared(msg) func mintPhotoNFT(args: {
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        perceptualHash: ?Text;
        deviceAttestation: ?Blob;
    }) : async Result.Result<Nat, Text> {
        await photoNFT.mintPhotoNFT(msg.caller, args);
    };
    
    public shared(msg) func uploadPhotoChunk(args: {
        tokenId: Nat;
        chunkIndex: Nat;
        chunkData: Blob;
    }) : async Result.Result<Text, Text> {
        await photoNFT.uploadPhotoChunk(msg.caller, args);
    };
    
    public query func getPhotoChunk(tokenId: Nat, chunkIndex: Nat) : async Result.Result<Blob, Text> {
        photoNFT.getPhotoChunk(tokenId, chunkIndex);
    };
    
    // Forward GameEngine calls
    public shared(msg) func createRound() : async Result.Result<Nat, Text> {
        await gameEngine.createRound(msg.caller);
    };
    
    public shared(msg) func submitGuess(args: {
        roundId: Nat;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
    }) : async Result.Result<Text, Text> {
        await gameEngine.submitGuess(msg.caller, args);
    };
    
    public shared(msg) func settleRound(roundId: Nat) : async Result.Result<Text, Text> {
        await gameEngine.settleRound(roundId);
    };
    
    // Forward ICRC-1 token calls
    public query func icrc1_name() : async Text {
        rewardMint.icrc1_name();
    };
    
    public query func icrc1_symbol() : async Text {
        rewardMint.icrc1_symbol();
    };
    
    public query func icrc1_decimals() : async Nat8 {
        rewardMint.icrc1_decimals();
    };
    
    public query func icrc1_total_supply() : async Nat {
        rewardMint.icrc1_total_supply();
    };
    
    public query func icrc1_balance_of(account: RewardMint.Account) : async Nat {
        rewardMint.icrc1_balance_of(account);
    };
    
    public shared(msg) func icrc1_transfer(args: RewardMint.TransferArgs) : async Result.Result<Nat, RewardMint.TransferError> {
        await rewardMint.icrc1_transfer(msg.caller, args);
    };
    
    // Forward ICRC-7 NFT calls
    public query func icrc7_name() : async Text {
        photoNFT.icrc7_name();
    };
    
    public query func icrc7_symbol() : async Text {
        photoNFT.icrc7_symbol();
    };
    
    public query func icrc7_total_supply() : async Nat {
        photoNFT.icrc7_total_supply();
    };
    
    public query func icrc7_balance_of(account: Principal) : async Nat {
        photoNFT.icrc7_balance_of(account);
    };
    
    public query func icrc7_owner_of(tokenId: Nat) : async ?Principal {
        photoNFT.icrc7_owner_of(tokenId);
    };
    
    // Asset management
    public shared(msg) func upload_asset(args: {
        path: Text;
        content: Blob;
        content_type: Text;
    }) : async Result.Result<Text, Text> {
        // Only allow admin to upload assets
        if (msg.caller != Principal.fromText("aaaaa-aa")) { // Replace with actual admin principal
            return #err("Unauthorized");
        };
        
        assets.store(args.path, args.content, args.content_type);
        #ok("Asset uploaded successfully");
    };
    
    // System functions
    system func preupgrade() {
        // Save state before upgrade
    };
    
    system func postupgrade() {
        // Restore state after upgrade
    };
}