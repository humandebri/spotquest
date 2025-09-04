import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Float "mo:base/Float";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Hash "mo:base/Hash";

import Constants "Constants";

module {
    // Types
    public type Guess = {
        player: Principal;
        photoId: Nat;
        lat: Float;
        lon: Float;
        dist: Float;
        sessionId: Text;
        timestamp: Time.Time;
    };
    
    public type Heatmap = {
        photoId: Nat;
        heatmap: [[Float]]; // 2D grid of guess density
        bounds: { minLat: Float; maxLat: Float; minLon: Float; maxLon: Float };
        gridSize: Nat;
        totalGuesses: Nat;
    };
    
    public class GuessHistoryManager() {
        // Storage
        private var guessRecords = TrieMap.TrieMap<Nat, Buffer.Buffer<Guess>>(Nat.equal, Hash.hash);
        private var playerHistory = TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
        private var photoQualityScores = TrieMap.TrieMap<Nat, Float>(Nat.equal, Hash.hash);
        
        // Metrics
        private var totalGuesses : Nat = 0;
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        // Record a new guess
        public func recordGuess(guess: Guess) : Result.Result<Nat, Text> {
            // Input validation
            if (Principal.toText(guess.player) == "") {
                return #err("Invalid player principal");
            };
            
            if (guess.photoId == 0) {
                return #err("Invalid photo ID");
            };
            
            if (guess.lat < -90.0 or guess.lat > 90.0) {
                return #err("Invalid latitude");
            };
            
            if (guess.lon < -180.0 or guess.lon > 180.0) {
                return #err("Invalid longitude");
            };
            
            if (guess.dist < 0.0) {
                return #err("Invalid distance");
            };
            
            // Get or create guess buffer for photo
            let photoGuesses = switch(guessRecords.get(guess.photoId)) {
                case null {
                    let buffer = Buffer.Buffer<Guess>(10);
                    guessRecords.put(guess.photoId, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            // Check limit
            if (photoGuesses.size() >= Constants.MAX_GUESSES_PER_PHOTO) {
                return #err("Photo has reached maximum guess limit");
            };
            
            // Record guess
            photoGuesses.add(guess);
            totalGuesses += 1;
            
            // Update player history
            let history = switch(playerHistory.get(guess.player)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    playerHistory.put(guess.player, buffer);
                    buffer
                };
                case (?buffer) { buffer };
            };
            
            // Add to player history if not already present
            let alreadyGuessed = Buffer.contains<Nat>(history, guess.photoId, Nat.equal);
            if (not alreadyGuessed) {
                if (history.size() >= Constants.MAX_PLAYER_HISTORY) {
                    // Remove oldest entry
                    ignore history.remove(0);
                };
                history.add(guess.photoId);
            };
            
            // Update photo quality score
            updatePhotoQualityScore(guess.photoId);
            
            #ok(totalGuesses)
        };
        
        // Get guesses for a photo
        public func getPhotoGuesses(photoId: Nat, limit: ?Nat) : [Guess] {
            switch(guessRecords.get(photoId)) {
                case null { [] };
                case (?guesses) {
                    let actualLimit = switch(limit) {
                        case null { guesses.size() };
                        case (?l) { Nat.min(l, guesses.size()) };
                    };
                    
                    // Return most recent guesses
                    if (actualLimit == guesses.size()) {
                        Buffer.toArray(guesses)
                    } else {
                        let result = Buffer.Buffer<Guess>(actualLimit);
                        let start = guesses.size() - actualLimit;
                        for (i in Iter.range(start, guesses.size() - 1)) {
                            result.add(guesses.get(i));
                        };
                        Buffer.toArray(result)
                    }
                };
            }
        };
        
        // Get player's guess history
        public func getPlayerHistory(player: Principal, limit: ?Nat) : [Nat] {
            switch(playerHistory.get(player)) {
                case null { [] };
                case (?history) {
                    let actualLimit = switch(limit) {
                        case null { history.size() };
                        case (?l) { Nat.min(l, history.size()) };
                    };
                    
                    if (actualLimit == history.size()) {
                        Buffer.toArray(history)
                    } else {
                        let result = Buffer.Buffer<Nat>(actualLimit);
                        let start = history.size() - actualLimit;
                        for (i in Iter.range(start, history.size() - 1)) {
                            result.add(history.get(i));
                        };
                        Buffer.toArray(result)
                    }
                };
            }
        };
        
        // Generate heatmap for a photo
        public func generateHeatmap(photoId: Nat) : Result.Result<Heatmap, Text> {
            switch(guessRecords.get(photoId)) {
                case null { #err("No guesses found for photo") };
                case (?guesses) {
                    if (guesses.size() == 0) {
                        return #err("No guesses found for photo");
                    };
                    
                    // Find bounds
                    var minLat = guesses.get(0).lat;
                    var maxLat = guesses.get(0).lat;
                    var minLon = guesses.get(0).lon;
                    var maxLon = guesses.get(0).lon;
                    
                    for (guess in guesses.vals()) {
                        if (guess.lat < minLat) { minLat := guess.lat };
                        if (guess.lat > maxLat) { maxLat := guess.lat };
                        if (guess.lon < minLon) { minLon := guess.lon };
                        if (guess.lon > maxLon) { maxLon := guess.lon };
                    };
                    
                    // Add padding
                    let latPadding = (maxLat - minLat) * 0.1;
                    let lonPadding = (maxLon - minLon) * 0.1;
                    
                    minLat := minLat - latPadding;
                    maxLat := maxLat + latPadding;
                    minLon := minLon - lonPadding;
                    maxLon := maxLon + lonPadding;
                    
                    // Create grid
                    let gridSize = Constants.GRID_SIZE;
                    let grid = Array.init<[var Float]>(gridSize, Array.init<Float>(gridSize, 0.0));
                    
                    // Populate grid
                    for (guess in guesses.vals()) {
                        let xRatio = (guess.lon - minLon) / (maxLon - minLon);
                        let yRatio = (guess.lat - minLat) / (maxLat - minLat);
                        
                        let xIndexInt = Float.toInt(xRatio * Float.fromInt(gridSize - 1));
                        let yIndexInt = Float.toInt(yRatio * Float.fromInt(gridSize - 1));
                        
                        if (xIndexInt >= 0 and yIndexInt >= 0) {
                            let xIndex = Int.abs(xIndexInt);
                            let yIndex = Int.abs(yIndexInt);
                            if (xIndex < gridSize and yIndex < gridSize) {
                                grid[yIndex][xIndex] += 1.0;
                            };
                        };
                    };
                    
                    // Convert to immutable array
                    let heatmapData = Array.map<[var Float], [Float]>(
                        Array.freeze(grid),
                        func(row) = Array.freeze(row)
                    );
                    
                    #ok({
                        photoId = photoId;
                        heatmap = heatmapData;
                        bounds = {
                            minLat = minLat;
                            maxLat = maxLat;
                            minLon = minLon;
                            maxLon = maxLon;
                        };
                        gridSize = gridSize;
                        totalGuesses = guesses.size();
                    })
                };
            }
        };
        
        // Get photo quality score
        public func getPhotoQualityScore(photoId: Nat) : Float {
            switch(photoQualityScores.get(photoId)) {
                case null { 0.5 }; // Default score
                case (?score) { score };
            }
        };
        
        // Get total guesses
        public func getTotalGuesses() : Nat {
            totalGuesses
        };
        
        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            totalGuesses: Nat;
            guessRecordsStable: [(Nat, [Guess])];
            playerHistoryStable: [(Principal, [Nat])];
            photoQualityScoresStable: [(Nat, Float)];
        } {
            {
                totalGuesses = totalGuesses;
                guessRecordsStable = Array.map<(Nat, Buffer.Buffer<Guess>), (Nat, [Guess])>(
                    Iter.toArray(guessRecords.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                playerHistoryStable = Array.map<(Principal, Buffer.Buffer<Nat>), (Principal, [Nat])>(
                    Iter.toArray(playerHistory.entries()),
                    func(entry) = (entry.0, Buffer.toArray(entry.1))
                );
                photoQualityScoresStable = Iter.toArray(photoQualityScores.entries());
            }
        };
        
        public func fromStable(stableData: {
            totalGuesses: Nat;
            guessRecordsStable: [(Nat, [Guess])];
            playerHistoryStable: [(Principal, [Nat])];
            photoQualityScoresStable: [(Nat, Float)];
        }) {
            totalGuesses := stableData.totalGuesses;
            
            guessRecords := TrieMap.TrieMap<Nat, Buffer.Buffer<Guess>>(Nat.equal, Hash.hash);
            for ((photoId, guesses) in stableData.guessRecordsStable.vals()) {
                let buffer = Buffer.Buffer<Guess>(guesses.size());
                for (guess in guesses.vals()) {
                    buffer.add(guess);
                };
                guessRecords.put(photoId, buffer);
            };
            
            playerHistory := TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
            for ((player, photos) in stableData.playerHistoryStable.vals()) {
                let buffer = Buffer.Buffer<Nat>(photos.size());
                for (photoId in photos.vals()) {
                    buffer.add(photoId);
                };
                playerHistory.put(player, buffer);
            };
            
            photoQualityScores := TrieMap.fromEntries(
                stableData.photoQualityScoresStable.vals(),
                Nat.equal,
                Hash.hash
            );
        };
        
        // ======================================
        // PRIVATE HELPERS
        // ======================================
        
        private func updatePhotoQualityScore(photoId: Nat) {
            switch(guessRecords.get(photoId)) {
                case null { };
                case (?guesses) {
                    if (guesses.size() < 10) {
                        return; // Not enough data
                    };
                    
                    // Calculate median distance
                    let distances = Array.map<Guess, Float>(
                        Buffer.toArray(guesses),
                        func(g) = g.dist
                    );
                    
                    let sorted = Array.sort<Float>(distances, Float.compare);
                    let median = if (sorted.size() % 2 == 0) {
                        (sorted[sorted.size() / 2 - 1] + sorted[sorted.size() / 2]) / 2.0
                    } else {
                        sorted[sorted.size() / 2]
                    };
                    
                    // Quality score formula: Q = 1 - clamp(d_median / 300, 0, 1)
                    let normalizedMedian = Float.min(1.0, Float.max(0.0, median / 300.0));
                    let qualityScore = 1.0 - normalizedMedian;
                    
                    photoQualityScores.put(photoId, qualityScore);
                };
            };
        };
    };
}