import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Float "mo:base/Float";

module {
    // Game round types
    public type GameRound = {
        id: Nat;
        photoId: Nat;
        photoMeta: PhotoMeta;
        startTime: Time.Time;
        endTime: ?Time.Time;
        participants: [Principal];
        submissions: [Submission];
        settled: Bool;
    };
    
    public type Submission = {
        player: Principal;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
        submissionTime: Time.Time;
        distance: ?Float;
        azimuthError: ?Float;
        score: ?Nat;
        reward: ?Nat;
    };
    
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
    
    public type PlayerStats = {
        totalRounds: Nat;
        totalScore: Nat;
        totalRewards: Nat;
        averageDistance: Float;
    };
    
    // Constants
    public let PLAY_FEE : Nat = 1; // 0.01 SPOT
    public let ROUND_DURATION : Time.Time = 300_000_000_000; // 5 minutes
    public let MIN_QUALITY_FOR_GAME : Float = 0.3;
    
    // Scoring parameters
    public let R_FULL : Float = 25.0;
    public let R_ZERO : Float = 1000.0;
    public let THETA_MAX : Float = 30.0;
    public let GAMMA : Float = 1.3;
    public let DELTA : Float = 0.7;
    public let S_MAX : Float = 100.0;
    
    // Reward parameters
    public let BASE_REWARD_MULTIPLIER : Float = 0.02;
    public let UPLOADER_REWARD_RATIO : Float = 0.30;
    public let DECAY_FACTOR : Float = 0.05;
}