import Time "mo:base/Time";
import Principal "mo:base/Principal";

module {
    // Session types
    public type SessionId = Text;
    
    public type SessionStatus = {
        #Active;
        #Completed;
        #Abandoned;
    };
    
    public type SessionInfo = {
        id: SessionId;
        players: [Principal];
        status: SessionStatus;
        createdAt: Time.Time;
        roundCount: Nat;
        currentRound: ?Nat;
    };
    
    public type GameSession = {
        id: SessionId;
        userId: Principal;
        rounds: [RoundState];
        currentRound: Nat;
        totalScore: Nat;          // 0-5000 display score sum
        totalScoreNorm: Nat;      // 0-100 normalized score sum
        retryCount: Nat;
        startTime: Time.Time;
        endTime: ?Time.Time;
        lastActivity: Time.Time;
    };
    
    public type RoundState = {
        photoId: Nat;
        status: RoundStatus;
        score: Nat;               // 0-5000 display score
        scoreNorm: Nat;           // 0-100 normalized score
        guessData: ?GuessData;
        retryAvailable: Bool;
        hintsPurchased: [HintType];
        startTime: Time.Time;
        endTime: ?Time.Time;
    };
    
    public type RoundStatus = {
        #Active;
        #Completed;
        #Retried;
        #TimedOut;
    };
    
    public type GuessData = {
        lat: Float;
        lon: Float;
        azimuth: ?Float;
        confidenceRadius: Float;
        submittedAt: Time.Time;
    };
    
    // Hint types
    public type HintType = {
        #BasicRadius;     // ±50m circle hint
        #PremiumRadius;   // High quality hint from similar locations
        #DirectionHint;   // Cardinal direction hint
    };
    
    public type HintData = {
        hintType: HintType;
        data: HintContent;
    };
    
    public type HintContent = {
        #RadiusHint: { centerLat: Float; centerLon: Float; radius: Float };
        #DirectionHint: Text; // "North", "Southeast", etc.
    };
    
    // Score calculation parameters
    public type ScoreParams = {
        alpha: Nat;      // Distance coefficient (fixed point)
        beta: Nat;       // Distance exponent (fixed point)
        maxScore: Nat;   // Maximum possible score
        precision: Nat;  // Fixed point precision
    };
    
    // Session results
    public type SessionResult = {
        sessionId: SessionId;
        userId: Principal;
        totalScore: Nat;
        totalScoreNorm: Nat;
        completedRounds: Nat;
        totalRounds: Nat;
        playerReward: Nat;     // SPOT tokens earned
        uploaderRewards: [(Principal, Nat)]; // Uploader rewards
        duration: Nat;         // Session duration in nanoseconds
        rank: ?Nat;           // Ranking if applicable
    };
    
    // Treasury and Sink types
    public type SinkType = {
        #Retry;
        #HintBasic;
        #HintPremium;
        #Proposal;
        #Boost;
        #PlayFee;
    };
    
    public type TreasuryAction = {
        #Burn: Nat;
        #Transfer: { to: Principal; amount: Nat };
        #AutoBurn;
        #RewardPool: Nat;
    };
    
    // Boost types for photos
    public type BoostType = {
        #Bronze;   // 1.5x frequency
        #Silver;   // 2x frequency
        #Gold;     // 3x frequency
    };
    
    // Fix request for community corrections
    public type FixRequest = {
        id: Text;
        requester: Principal;
        photoId: Nat;
        issue: FixIssue;
        proposedFix: ProposedFix;
        status: FixStatus;
        votes: { approve: Nat; reject: Nat };
        createdAt: Time.Time;
        resolvedAt: ?Time.Time;
    };
    
    public type FixIssue = {
        #WrongLocation;
        #WrongAzimuth;
        #PoorQuality;
        #Privacy;
    };
    
    public type ProposedFix = {
        #LocationFix: { lat: Float; lon: Float };
        #AzimuthFix: Float;
        #RemovePhoto;
    };
    
    public type FixStatus = {
        #Pending;
        #Approved;
        #Rejected;
        #Implemented;
    };
    
    // Metrics and monitoring
    public type CanisterMetrics = {
        memoryUsage: Nat;
        cyclesBalance: Nat;
        errorRate: Float;
        requestsPerMinute: Nat;
        activeUsers: Nat;
        customMetrics: [(Text, Float)];
    };
    
    // Feature flags for gradual rollout
    public type FeatureFlag = {
        name: Text;
        enabled: Bool;
        rolloutPercentage: Nat; // 0-100
        whitelist: [Principal];
    };
}