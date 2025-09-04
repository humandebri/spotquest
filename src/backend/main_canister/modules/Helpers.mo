import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Random "mo:base/Random";
import Blob "mo:base/Blob";
import Iter "mo:base/Iter";

import Constants "Constants";

module {
    // ======================================
    // MATH HELPERS
    // ======================================
    
    // Calculate Haversine distance between two coordinates (in meters)
    public func calculateHaversineDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
        let R = 6371000.0; // Earth's radius in meters
        
        let dLat = (lat2 - lat1) * (Float.pi / 180.0);
        let dLon = (lon2 - lon1) * (Float.pi / 180.0);
        
        let a = Float.sin(dLat / 2.0) * Float.sin(dLat / 2.0) +
                Float.cos(lat1 * (Float.pi / 180.0)) * Float.cos(lat2 * (Float.pi / 180.0)) *
                Float.sin(dLon / 2.0) * Float.sin(dLon / 2.0);
        
        let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
        
        R * c
    };
    
    // Calculate score using exponential decay (matching frontend)
    public func calculateScoreFixed(distance: Nat) : (Nat, Nat) {
        let MAX_SCORE = Constants.MAX_SCORE;
        let PERFECT_DISTANCE = Constants.PERFECT_DISTANCE;
        
        if (distance <= PERFECT_DISTANCE) {
            // Perfect score for distances <= 10 meters
            let normScore = (MAX_SCORE + 49) / 50;
            return (MAX_SCORE, normScore);
        } else {
            // Exponential decay formula: 5000 * exp(-0.15 * distanceInKm)
            // Since Motoko doesn't have exp(), we use approximation
            let distanceInKm = distance / 1000;
            let k = 15; // 0.15 * 100 for fixed point
            let exponent = k * distanceInKm / 100; // -0.15 * distanceInKm
            
            // Taylor series approximation for exp(-x): 1 - x + x²/2 - x³/6 + x⁴/24 - ...
            // For better accuracy with larger x values, we use: e^(-x) ≈ 1/(1 + x + x²/2 + x³/6)
            let x = exponent;
            let x2 = x * x;
            let x3 = x2 * x / 6;
            let denominator = 1000 + x * 10 + x2 * 5 + x3; // *1000 for precision
            
            let expApprox = if (denominator > 0) { 1000000 / denominator } else { 0 }; // *1000 more for precision
            let scoreFloat = MAX_SCORE * expApprox / 1000; // Adjust back
            
            // Ensure minimum score is 0 and within bounds
            let finalScore = Nat.min(MAX_SCORE, scoreFloat);
            
            // Calculate normalized score
            let normScore = (finalScore + 49) / 50;
            
            (finalScore, normScore)
        }
    };
    
    // ======================================
    // SESSION HELPERS
    // ======================================
    
    // Generate unique session ID
    public func generateSessionId(userId: Principal, prng: Random.Finite) : Text {
        let timestamp = Int.abs(Time.now());
        let random = switch(prng.byte()) {
            case null { 0 };
            case (?b) { Nat8.toNat(b) };
        };
        
        Principal.toText(userId) # "_" # Int.toText(timestamp) # "_" # Nat.toText(random)
    };
    
    // ======================================
    // VALIDATION HELPERS
    // ======================================
    
    // Validate coordinates
    public func isValidLatitude(lat: Float) : Bool {
        lat >= -90.0 and lat <= 90.0
    };
    
    public func isValidLongitude(lon: Float) : Bool {
        lon >= -180.0 and lon <= 180.0
    };
    
    // Validate principal
    public func isValidPrincipal(p: Principal) : Bool {
        Principal.toText(p) != ""
    };
    
    // ======================================
    // TIME HELPERS
    // ======================================
    
    // Get current time in seconds
    public func getCurrentTimeSeconds() : Nat {
        Int.abs(Time.now()) / Constants.NANOSECONDS_PER_SECOND
    };
    
    // Get days elapsed between two timestamps
    public func getDaysElapsed(startTime: Time.Time, endTime: Time.Time) : Nat {
        let elapsed = Int.abs(endTime - startTime);
        Nat64.toNat(Nat64.fromNat(elapsed) / Nat64.fromNat(Constants.NANOSECONDS_PER_SECOND * Constants.SECONDS_PER_DAY))
    };
    
    // ======================================
    // DIRECTION HELPERS
    // ======================================
    
    // Get cardinal direction from azimuth
    public func getCardinalDirection(azimuth: Float) : Text {
        if (azimuth < 22.5 or azimuth >= 337.5) { "North" }
        else if (azimuth < 67.5) { "Northeast" }
        else if (azimuth < 112.5) { "East" }
        else if (azimuth < 157.5) { "Southeast" }
        else if (azimuth < 202.5) { "South" }
        else if (azimuth < 247.5) { "Southwest" }
        else if (azimuth < 292.5) { "West" }
        else { "Northwest" }
    };
    
    // ======================================
    // ARRAY HELPERS
    // ======================================
    
    // Safe array access
    public func safeArrayGet<T>(arr: [T], index: Nat) : ?T {
        if (index < arr.size()) {
            ?arr[index]
        } else {
            null
        }
    };
}