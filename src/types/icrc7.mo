import Principal "mo:base/Principal";
import Time "mo:base/Time";

module {
    // ICRC-7 NFT Standard types
    public type TokenId = Nat;
    
    public type Account = {
        owner: Principal;
        subaccount: ?Blob;
    };
    
    public type TransferArgs = {
        from_subaccount: ?Blob;
        to: Account;
        token_id: TokenId;
        memo: ?Blob;
        created_at_time: ?Time.Time;
    };
    
    public type TransferError = {
        #NonExistingTokenId;
        #InvalidRecipient;
        #Unauthorized;
        #TooOld;
        #CreatedInFuture: { ledger_time: Nat64 };
        #Duplicate: { duplicate_of: Nat };
        #GenericError: { error_code: Nat; message: Text };
    };
    
    public type Metadata = {
        key: Text;
        value: MetadataValue;
    };
    
    public type MetadataValue = {
        #Nat: Nat;
        #Int: Int;
        #Text: Text;
        #Blob: Blob;
    };
    
    public type SupportedStandard = {
        name: Text;
        url: Text;
    };
}