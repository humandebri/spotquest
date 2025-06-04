import Principal "mo:base/Principal";
import Time "mo:base/Time";

module {
    public type Account = {
        owner: Principal;
        subaccount: ?Blob;
    };

    public type TransferArgs = {
        from_subaccount: ?Blob;
        to: Account;
        amount: Nat;
        fee: ?Nat;
        memo: ?Blob;
        created_at_time: ?Time.Time;
    };

    public type TransferError = {
        #BadFee: { expected_fee: Nat };
        #BadBurn: { min_burn_amount: Nat };
        #InsufficientFunds: { balance: Nat };
        #TooOld;
        #CreatedInFuture: { ledger_time: Nat64 };
        #Duplicate: { duplicate_of: Nat };
        #TemporarilyUnavailable;
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