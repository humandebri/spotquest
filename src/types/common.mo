import Result "mo:base/Result";

module {
    // Common result types
    public type ApiResult<T> = Result.Result<T, ApiError>;
    
    public type ApiError = {
        #NotFound;
        #Unauthorized;
        #InvalidInput: Text;
        #InsufficientFunds: { balance: Nat };
        #AlreadyExists;
        #RateLimited;
        #Internal: Text;
    };
    
    // Common validation functions
    public func validatePrincipal(p: Principal) : Bool {
        Principal.toText(p).size() > 0;
    };
    
    public func validateNat(n: Nat, min: Nat, max: Nat) : Bool {
        n >= min and n <= max;
    };
    
    public func validateFloat(f: Float, min: Float, max: Float) : Bool {
        f >= min and f <= max;
    };
}