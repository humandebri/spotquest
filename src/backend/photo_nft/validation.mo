import Float "mo:base/Float";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Nat8 "mo:base/Nat8";
import Nat "mo:base/Nat";
import Array "mo:base/Array";

module {
    // GPS validation constants
    private let MIN_LAT : Float = -90.0;
    private let MAX_LAT : Float = 90.0;
    private let MIN_LON : Float = -180.0;
    private let MAX_LON : Float = 180.0;
    
    // Photo validation constants
    private let MIN_PHOTO_SIZE : Nat = 10240; // 10KB minimum
    private let MAX_PHOTO_SIZE : Nat = 5242880; // 5MB maximum
    private let ALLOWED_FORMATS : [Text] = ["jpg", "jpeg", "png", "webp"];
    
    // Time validation constants
    private let MAX_FUTURE_TIME : Time.Time = 60_000_000_000; // 1 minute in nanoseconds
    private let MAX_AGE : Time.Time = 31536000000000000; // 1 year in nanoseconds (365*24*60*60*1_000_000_000)

    // Validate GPS coordinates
    public func validateGPSCoordinates(lat: Float, lon: Float) : Result.Result<(), Text> {
        if (lat < MIN_LAT or lat > MAX_LAT) {
            return #err("Invalid latitude: must be between -90 and 90");
        };
        
        if (lon < MIN_LON or lon > MAX_LON) {
            return #err("Invalid longitude: must be between -180 and 180");
        };
        
        // Check for suspicious coordinates (0,0) which might indicate missing data
        if (lat == 0.0 and lon == 0.0) {
            return #err("Suspicious coordinates: (0,0) may indicate missing GPS data");
        };
        
        #ok();
    };
    
    // Validate azimuth (compass direction)
    public func validateAzimuth(azim: Float) : Result.Result<(), Text> {
        if (azim < 0.0 or azim > 360.0) {
            return #err("Invalid azimuth: must be between 0 and 360 degrees");
        };
        #ok();
    };
    
    // Validate timestamp
    public func validateTimestamp(timestamp: Time.Time) : Result.Result<(), Text> {
        let now = Time.now();
        
        // Check if timestamp is in the future
        if (timestamp > now + MAX_FUTURE_TIME) {
            return #err("Invalid timestamp: cannot be in the future");
        };
        
        // Check if timestamp is too old
        if (timestamp < now - MAX_AGE) {
            return #err("Invalid timestamp: photo is too old (>1 year)");
        };
        
        #ok();
    };
    
    // Simple perceptual hash implementation
    public func calculatePerceptualHash(imageData: Blob) : Text {
        // This is a simplified version - in production, use a proper algorithm
        let bytes = Blob.toArray(imageData);
        var hash = 0 : Nat;
        
        // Sample every 100th byte to create a simple hash
        var i = 0;
        while (i < bytes.size() and i < 1000) {
            hash := hash + Nat8.toNat(bytes[i]);
            i += 100;
        };
        
        // Convert to hex string
        Text.concat("phash_", Nat.toText(hash));
    };
    
    // Check for duplicate photos using perceptual hash
    public func isDuplicateHash(hash1: Text, hash2: Text, threshold: Float) : Bool {
        // Simplified comparison - in production, use proper hamming distance
        hash1 == hash2;
    };
    
    // Validate photo file size
    public func validatePhotoSize(size: Nat) : Result.Result<(), Text> {
        if (size < MIN_PHOTO_SIZE) {
            return #err("Photo too small: minimum 10KB required");
        };
        
        if (size > MAX_PHOTO_SIZE) {
            return #err("Photo too large: maximum 5MB allowed");
        };
        
        #ok();
    };
    
    // Detect image format from blob header
    public func detectImageFormat(data: Blob) : ?Text {
        let bytes = Blob.toArray(data);
        
        if (bytes.size() < 4) {
            return null;
        };
        
        // Check JPEG signature (FF D8 FF)
        if (bytes[0] == 0xFF and bytes[1] == 0xD8 and bytes[2] == 0xFF) {
            return ?"jpeg";
        };
        
        // Check PNG signature (89 50 4E 47)
        if (bytes[0] == 0x89 and bytes[1] == 0x50 and bytes[2] == 0x4E and bytes[3] == 0x47) {
            return ?"png";
        };
        
        // Check WebP signature (52 49 46 46 ... 57 45 42 50)
        if (bytes.size() >= 12 and 
            bytes[0] == 0x52 and bytes[1] == 0x49 and bytes[2] == 0x46 and bytes[3] == 0x46 and
            bytes[8] == 0x57 and bytes[9] == 0x45 and bytes[10] == 0x42 and bytes[11] == 0x50) {
            return ?"webp";
        };
        
        null;
    };
    
    // Comprehensive photo validation
    public func validatePhoto(args: {
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        photoData: Blob;
        perceptualHash: ?Text;
    }) : Result.Result<Text, Text> {
        // Validate GPS coordinates
        switch (validateGPSCoordinates(args.lat, args.lon)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate azimuth
        switch (validateAzimuth(args.azim)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate timestamp
        switch (validateTimestamp(args.timestamp)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Validate photo size
        let photoSize = args.photoData.size();
        switch (validatePhotoSize(photoSize)) {
            case (#err(e)) { return #err(e) };
            case (#ok()) {};
        };
        
        // Detect and validate format
        switch (detectImageFormat(args.photoData)) {
            case null { return #err("Unknown or unsupported image format") };
            case (?format) {
                var isAllowed = false;
                for (allowed in ALLOWED_FORMATS.vals()) {
                    if (format == allowed) {
                        isAllowed := true;
                    };
                };
                if (not isAllowed) {
                    return #err("Unsupported image format: " # format);
                };
            };
        };
        
        // Calculate perceptual hash if not provided
        let hash = switch (args.perceptualHash) {
            case null { calculatePerceptualHash(args.photoData) };
            case (?h) { h };
        };
        
        #ok(hash);
    };
    
    // Validate SafetyNet/App Attest token (placeholder for future implementation)
    public func validateDeviceAttestation(attestation: Blob) : Result.Result<(), Text> {
        // TODO: Implement actual attestation validation
        // For now, just check if attestation is provided
        if (attestation.size() == 0) {
            return #err("Device attestation required");
        };
        #ok();
    };
}