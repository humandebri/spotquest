import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";

module {
    // ======================================
    // TOKEN CONSTANTS
    // ======================================
    public let TOKEN_NAME : Text = "Guess the Spot Token";
    public let TOKEN_SYMBOL : Text = "SPOT";
    public let TOKEN_DECIMALS : Nat8 = 2;
    public let TOKEN_TRANSFER_FEE : Nat = 1; // 0.01 SPOT
    
    // ======================================
    // GAME ENGINE CONSTANTS
    // ======================================
    public let MAX_CONCURRENT_SESSIONS : Nat = 2;
    public let SESSION_TIMEOUT : Nat = 1_800_000_000_000; // 30 minutes in nanoseconds
    public let ROUNDS_PER_SESSION : Nat = 10;
    public let RETRY_SCORE_THRESHOLD : Nat = 60; // Must score >= 60 to retry
    public let MAX_RETRIES_PER_SESSION : Nat = 2;
    public let BASIC_RADIUS_KM : Nat = 50; // 50km radius for basic hint
    public let PREMIUM_RADIUS_KM : Nat = 20; // 20km radius for premium hint
    
    // Score calculation constants
    public let MAX_SCORE : Nat = 5000;
    public let PERFECT_DISTANCE : Nat = 10; // meters for perfect score
    public let PRECISION : Nat = 1_000_000; // 6 decimal places (for other calculations)
    
    // ======================================
    // TREASURY CONSTANTS
    // ======================================
    // Sink fee constants (in 0.01 SPOT units, decimals=2)
    public let RETRY_FEE : Nat = 200; // 2.00 SPOT
    public let HINT_BASIC_FEE : Nat = 100; // 1.00 SPOT
    public let HINT_PREMIUM_FEE : Nat = 300; // 3.00 SPOT
    public let PROPOSAL_FEE : Nat = 1000; // 10.00 SPOT
    public let BOOST_FEE : Nat = 500; // 5.00 SPOT
    public let PLAY_FEE : Nat = 0; // 0.00 SPOT (free to play initially)
    
    public let TREASURY_BURN_THRESHOLD : Float = 0.05; // 5% of total supply
    public let MAX_SINK_HISTORY : Nat = 10000;
    
    // ======================================
    // GUESS HISTORY CONSTANTS
    // ======================================
    public let MAX_GUESSES_PER_PHOTO : Nat = 10_000;
    public let MAX_PLAYER_HISTORY : Nat = 1_000;
    public let GRID_SIZE : Nat = 50; // 50x50 heatmap grid
    
    // ======================================
    // PHOTO CONSTANTS
    // ======================================
    public let MAX_PHOTOS_PER_USER : Nat = 1000;
    public let MAX_PHOTO_CHUNK_SIZE : Nat = 2097152; // 2MB
    public let MAX_SCHEDULED_PHOTOS : Nat = 100;
    public let MAX_SCHEDULED_PHOTOS_PER_USER : Nat = 10;
    
    // ======================================
    // REPUTATION CONSTANTS
    // ======================================
    public let MIN_QUALITY_SCORE : Float = 0.0;
    public let MAX_QUALITY_SCORE : Float = 1.0;
    public let QUALITY_SCORE_DECAY_DAYS : Nat = 30;
    public let DEFAULT_REPUTATION : Float = 0.5;
    public let MIN_REPUTATION : Float = 0.0;
    public let MAX_REPUTATION : Float = 1.0;
    public let UPLOAD_REWARD : Float = 0.2;
    public let VALIDATION_REWARD : Float = 0.1;
    public let VALIDATION_PENALTY : Float = 0.05;
    public let INVALID_PHOTO_PENALTY : Float = 0.2;
    
    // ======================================
    // REWARD CONSTANTS
    // ======================================
    public let BASE_REWARD_PLAYER : Nat = 20000; // Base reward in 0.01 SPOT units
    public let UPLOADER_REWARD_RATE : Nat = 30; // 30% of player reward
    
    // ======================================
    // TIME CONSTANTS
    // ======================================
    public let NANOSECONDS_PER_SECOND : Nat = 1_000_000_000;
    public let SECONDS_PER_DAY : Nat = 86400;
}