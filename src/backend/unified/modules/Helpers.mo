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
    
    // Calculate score based on distance (fixed point arithmetic)
    public func calculateScoreFixed(distance: Nat) : (Nat, Nat) {
        if (distance > 2147483647) { // Max safe value for calculations
            return (0, 0);
        };
        
        // Distance is in meters, convert to fixed point
        let distanceFixed = distance * Constants.PRECISION;
        
        // Calculate d^BETA where BETA = 1.3
        // Using approximation: d^1.3 ≈ d * (d^0.3)
        // d^0.3 ≈ d^(1/3) * d^(-0.033) ≈ cbrt(d) * 0.93
        let d3 = distance * distance * distance;
        var cbrt_d = 1;
        
        // Newton's method for cube root
        if (d3 > 0) {
            cbrt_d := distance / 2;
            for (_ in Iter.range(0, 4)) {
                if (cbrt_d > 0) {
                    cbrt_d := (2 * cbrt_d + distance * distance / (cbrt_d * cbrt_d)) / 3;
                };
            };
        };
        
        // Approximate d^0.3 = cbrt(d) * 0.93
        let d_03 = cbrt_d * 93 / 100;
        let dPower = distance * d_03;
        
        // Calculate score
        let maxScoreFixed = Constants.MAX_SCORE * Constants.PRECISION;
        let reduction = Constants.ALPHA * dPower / Constants.PRECISION;
        let scoreFixed = if (maxScoreFixed > reduction) { maxScoreFixed - reduction } else { 0 };
        let displayScore = scoreFixed / Constants.PRECISION;
        
        // Ensure score is within bounds
        let finalScore = Nat.min(Constants.MAX_SCORE, displayScore);
        
        // Calculate normalized score
        let normScore = (finalScore + 49) / 50;
        
        (finalScore, normScore)
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