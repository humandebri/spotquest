import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Int "mo:base/Int";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Random "mo:base/Random";
import Nat64 "mo:base/Nat64";
import Photo "../../types/photo";

actor GameEngine {
    // Owner and connected canisters
    private stable var owner : Principal = Principal.fromText("aaaaa-aa");
    private stable var photoNFTCanisterId : ?Principal = null;
    private stable var rewardMintCanisterId : ?Principal = null;
    private stable var reputationOracleCanisterId : ?Principal = null;
    
    // Game state
    public type GameRound = {
        id: Nat;
        photoId: Nat;
        photoMeta: Photo.PhotoMeta;
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
    
    // Game parameters
    private stable var PLAY_FEE : Nat = 1; // 0.01 SPOT
    private stable var ROUND_DURATION : Time.Time = 300_000_000_000; // 5 minutes in nanoseconds
    private stable var MIN_QUALITY_FOR_GAME : Float = 0.3;
    
    // Scoring parameters
    private stable var R_FULL : Float = 25.0; // meters for full score
    private stable var R_ZERO : Float = 1000.0; // meters for zero score
    private stable var THETA_MAX : Float = 30.0; // degrees for azimuth error
    private stable var GAMMA : Float = 1.3; // distance score exponent
    private stable var DELTA : Float = 0.7; // azimuth score exponent
    private stable var S_MAX : Float = 100.0; // maximum score
    
    // Reward parameters
    private stable var BASE_REWARD_MULTIPLIER : Float = 0.02; // 2% of score as base reward
    private stable var UPLOADER_REWARD_RATIO : Float = 0.30; // 30% of player reward goes to uploader
    private stable var totalRoundsPlayed : Nat = 0;
    
    // Storage
    private var activeRounds = HashMap.HashMap<Nat, GameRound>(10, Nat.equal, Nat.hash);
    private var completedRounds = HashMap.HashMap<Nat, GameRound>(10, Nat.equal, Nat.hash);
    private stable var activeRoundEntries : [(Nat, GameRound)] = [];
    private stable var completedRoundEntries : [(Nat, GameRound)] = [];
    private stable var nextRoundId : Nat = 0;
    
    // Random number generation
    private var prng : ?Random.Finite = null;
    
    system func preupgrade() {
        activeRoundEntries := Iter.toArray(activeRounds.entries());
        completedRoundEntries := Iter.toArray(completedRounds.entries());
    };
    
    system func postupgrade() {
        activeRounds := HashMap.fromIter<Nat, GameRound>(activeRoundEntries.vals(), activeRoundEntries.size(), Nat.equal, Nat.hash);
        completedRounds := HashMap.fromIter<Nat, GameRound>(completedRoundEntries.vals(), completedRoundEntries.size(), Nat.equal, Nat.hash);
    };
    
    // Admin functions
    public shared(msg) func setPhotoNFTCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set photo NFT canister");
        };
        photoNFTCanisterId := ?canisterId;
        #ok("Photo NFT canister set successfully");
    };
    
    public shared(msg) func setRewardMintCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set reward mint canister");
        };
        rewardMintCanisterId := ?canisterId;
        #ok("Reward mint canister set successfully");
    };
    
    public shared(msg) func setReputationOracleCanister(canisterId: Principal) : async Result.Result<Text, Text> {
        if (msg.caller != owner) {
            return #err("Only owner can set reputation oracle canister");
        };
        reputationOracleCanisterId := ?canisterId;
        #ok("Reputation oracle canister set successfully");
    };
    
    // Vincenty formula for accurate distance calculation
    private func calculateDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
        // WGS-84 ellipsoid parameters
        let a : Float = 6378137.0; // semi-major axis in meters
        let b : Float = 6356752.314245; // semi-minor axis in meters
        let f : Float = 1.0 / 298.257223563; // flattening
        
        let L = (lon2 - lon1) * Float.pi / 180.0;
        let U1 = Float.arctan((1.0 - f) * Float.tan(lat1 * Float.pi / 180.0));
        let U2 = Float.arctan((1.0 - f) * Float.tan(lat2 * Float.pi / 180.0));
        let sinU1 = Float.sin(U1);
        let cosU1 = Float.cos(U1);
        let sinU2 = Float.sin(U2);
        let cosU2 = Float.cos(U2);
        
        var lambda = L;
        var lambdaP = 2.0 * Float.pi;
        var iterLimit = 100;
        
        var sinLambda : Float = 0;
        var cosLambda : Float = 0;
        var sinSigma : Float = 0;
        var cosSigma : Float = 0;
        var sigma : Float = 0;
        var sinAlpha : Float = 0;
        var cosSqAlpha : Float = 0;
        var cos2SigmaM : Float = 0;
        var C : Float = 0;
        
        while (Float.abs(lambda - lambdaP) > 1e-12 and iterLimit > 0) {
            sinLambda := Float.sin(lambda);
            cosLambda := Float.cos(lambda);
            sinSigma := Float.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) + 
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * 
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
            
            if (sinSigma == 0.0) {
                return 0.0; // co-incident points
            };
            
            cosSigma := sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
            sigma := Float.arctan2(sinSigma, cosSigma);
            sinAlpha := cosU1 * cosU2 * sinLambda / sinSigma;
            cosSqAlpha := 1.0 - sinAlpha * sinAlpha;
            cos2SigmaM := cosSigma - 2.0 * sinU1 * sinU2 / cosSqAlpha;
            
            if (Float.isNaN(cos2SigmaM)) {
                cos2SigmaM := 0.0; // equatorial line
            };
            
            C := f / 16.0 * cosSqAlpha * (4.0 + f * (4.0 - 3.0 * cosSqAlpha));
            lambdaP := lambda;
            lambda := L + (1.0 - C) * f * sinAlpha * 
                (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * 
                (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM)));
            
            iterLimit -= 1;
        };
        
        if (iterLimit == 0) {
            return Float.nan(); // formula failed to converge
        };
        
        let uSq = cosSqAlpha * (a * a - b * b) / (b * b);
        let A = 1.0 + uSq / 16384.0 * (4096.0 + uSq * (-768.0 + uSq * (320.0 - 175.0 * uSq)));
        let B = uSq / 1024.0 * (256.0 + uSq * (-128.0 + uSq * (74.0 - 47.0 * uSq)));
        let deltaSigma = B * sinSigma * (cos2SigmaM + B / 4.0 * 
            (cosSigma * (-1.0 + 2.0 * cos2SigmaM * cos2SigmaM) - 
            B / 6.0 * cos2SigmaM * (-3.0 + 4.0 * sinSigma * sinSigma) * 
            (-3.0 + 4.0 * cos2SigmaM * cos2SigmaM)));
        
        b * A * (sigma - deltaSigma);
    };
    
    // Calculate azimuth error
    private func calculateAzimuthError(azim1: Float, azim2: Float) : Float {
        var diff = Float.abs(azim1 - azim2);
        if (diff > 180.0) {
            diff := 360.0 - diff;
        };
        diff;
    };
    
    // Calculate score based on distance and azimuth error
    private func calculateScore(distance: Float, azimuthError: Float) : Nat {
        // Distance score component
        let Sd = if (distance <= R_FULL) {
            1.0;
        } else if (distance >= R_ZERO) {
            0.0;
        } else {
            1.0 - (distance - R_FULL) / (R_ZERO - R_FULL);
        };
        
        // Azimuth score component
        let Sphi = if (azimuthError >= THETA_MAX) {
            0.0;
        } else {
            1.0 - azimuthError / THETA_MAX;
        };
        
        // Combined score
        let score = S_MAX * (Sd ** GAMMA) * (Sphi ** DELTA);
        Int.abs(Float.toInt(score));
    };
    
    // Calculate reward with decay factor
    private func calculateReward(score: Nat) : Nat {
        let decayFactor = 1.0 / (1.0 + 0.05 * Float.fromInt(totalRoundsPlayed));
        let reward = Float.fromInt(score) * BASE_REWARD_MULTIPLIER * decayFactor;
        Int.abs(Float.toInt(reward * 100.0)); // Convert to smallest unit (0.01 SPOT)
    };
    
    // Create new game round
    public shared(msg) func createRound() : async Result.Result<Nat, Text> {
        // TODO: Check if player paid play fee
        
        switch (photoNFTCanisterId) {
            case null { #err("Photo NFT canister not set") };
            case (?photoCanister) {
                // Get random photo for the game
                let photoActor = actor(Principal.toText(photoCanister)) : actor {
                    getPhotosForGame : (excludeOwner: ?Principal, minQuality: Float) -> async [Photo.PhotoMeta];
                };
                
                let photos = await photoActor.getPhotosForGame(?msg.caller, MIN_QUALITY_FOR_GAME);
                
                if (photos.size() == 0) {
                    return #err("No eligible photos available for game");
                };
                
                // Select random photo
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
                        
                        let round : GameRound = {
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
        };
    };
    
    // Submit guess for a round
    public shared(msg) func submitGuess(args: {
        roundId: Nat;
        guessLat: Float;
        guessLon: Float;
        guessAzim: Float;
    }) : async Result.Result<Text, Text> {
        switch (activeRounds.get(args.roundId)) {
            case null { #err("Round not found or already ended") };
            case (?round) {
                // Check if round is still active
                let currentTime = Time.now();
                if (currentTime - round.startTime > ROUND_DURATION) {
                    return #err("Round has ended");
                };
                
                // Check if player already submitted
                for (submission in round.submissions.vals()) {
                    if (submission.player == msg.caller) {
                        return #err("Already submitted guess for this round");
                    };
                };
                
                // Calculate distance and azimuth error
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
                
                // Calculate score
                let score = calculateScore(distance, azimuthError);
                let reward = calculateReward(score);
                
                // Create submission
                let submission : Submission = {
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
                
                // Update round with new submission
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
    
    // Settle round and distribute rewards
    public shared(msg) func settleRound(roundId: Nat) : async Result.Result<Text, Text> {
        switch (activeRounds.get(roundId)) {
            case null { #err("Round not found") };
            case (?round) {
                if (round.settled) {
                    return #err("Round already settled");
                };
                
                // Check if round duration has passed
                let currentTime = Time.now();
                if (currentTime - round.startTime <= ROUND_DURATION) {
                    return #err("Round is still active");
                };
                
                switch (rewardMintCanisterId) {
                    case null { #err("Reward mint canister not set") };
                    case (?rewardCanister) {
                        let rewardActor = actor(Principal.toText(rewardCanister)) : actor {
                            mint : (to: Principal, amount: Nat) -> async Result.Result<Nat, Text>;
                        };
                        
                        // Distribute rewards to players
                        var totalPlayerRewards : Nat = 0;
                        for (submission in round.submissions.vals()) {
                            switch (submission.reward) {
                                case null {};
                                case (?reward) {
                                    if (reward > 0) {
                                        let _ = await rewardActor.mint(submission.player, reward);
                                        totalPlayerRewards += reward;
                                    };
                                };
                            };
                        };
                        
                        // Distribute reward to photo uploader
                        if (totalPlayerRewards > 0) {
                            let uploaderReward = Int.abs(Float.toInt(Float.fromInt(totalPlayerRewards) * UPLOADER_REWARD_RATIO));
                            let _ = await rewardActor.mint(round.photoMeta.owner, uploaderReward);
                        };
                        
                        // Mark round as settled
                        let settledRound = {
                            round with
                            endTime = ?currentTime;
                            settled = true;
                        };
                        
                        // Move to completed rounds
                        activeRounds.delete(roundId);
                        completedRounds.put(roundId, settledRound);
                        
                        // Update reputation scores
                        switch (reputationOracleCanisterId) {
                            case null {};
                            case (?repOracle) {
                                let repActor = actor(Principal.toText(repOracle)) : actor {
                                    updatePhotoReputation : ({
                                        photoId: Nat;
                                        roundId: Nat;
                                        playerScores: [Nat];
                                        badReports: Nat;
                                    }) -> async Result.Result<Text, Text>;
                                };
                                
                                // Extract player scores
                                let scores = Buffer.Buffer<Nat>(round.submissions.size());
                                for (submission in round.submissions.vals()) {
                                    switch (submission.score) {
                                        case null {};
                                        case (?score) { scores.add(score) };
                                    };
                                };
                                
                                let _ = await repActor.updatePhotoReputation({
                                    photoId = round.photoId;
                                    roundId = roundId;
                                    playerScores = Buffer.toArray(scores);
                                    badReports = 0; // TODO: Implement bad report counting
                                });
                            };
                        };
                        
                        #ok("Round settled successfully");
                    };
                };
            };
        };
    };
    
    // Query functions
    public query func getActiveRounds() : async [GameRound] {
        Iter.toArray(activeRounds.vals());
    };
    
    public query func getRound(roundId: Nat) : async ?GameRound {
        switch (activeRounds.get(roundId)) {
            case (?round) { ?round };
            case null { completedRounds.get(roundId) };
        };
    };
    
    public query func getPlayerStats(player: Principal) : async {
        totalRounds: Nat;
        totalScore: Nat;
        totalRewards: Nat;
        averageDistance: Float;
    } {
        var totalRounds = 0;
        var totalScore = 0;
        var totalRewards = 0;
        var totalDistance : Float = 0;
        
        for ((_, round) in completedRounds.entries()) {
            for (submission in round.submissions.vals()) {
                if (submission.player == player) {
                    totalRounds += 1;
                    switch (submission.score) {
                        case null {};
                        case (?score) { totalScore += score };
                    };
                    switch (submission.reward) {
                        case null {};
                        case (?reward) { totalRewards += reward };
                    };
                    switch (submission.distance) {
                        case null {};
                        case (?distance) { totalDistance += distance };
                    };
                };
            };
        };
        
        {
            totalRounds = totalRounds;
            totalScore = totalScore;
            totalRewards = totalRewards;
            averageDistance = if (totalRounds > 0) { totalDistance / Float.fromInt(totalRounds) } else { 0.0 };
        };
    };
}