import Time "mo:base/Time";
import Principal "mo:base/Principal";

module {
    public type PhotoId = Nat;
    
    public type PhotoMeta = {
        id: Nat;
        owner: Principal;
        lat: Float;
        lon: Float;
        azim: Float;
        timestamp: Time.Time;
        quality: Float;
        uploadTime: Time.Time;
        chunkCount: Nat;
        totalSize: Nat;
        perceptualHash: ?Text;
    };
    
    public type PhotoChunk = {
        photoId: PhotoId;
        chunkIndex: Nat;
        data: Blob;
    };
    
    public type UploadRequest = {
        meta: PhotoMeta;
        totalChunks: Nat;
    };
    
    public type ChunkUploadRequest = {
        photoId: PhotoId;
        chunkIndex: Nat;
        data: Blob;
    };
    
    public type ReputationData = {
        photoId: PhotoId;
        totalPlays: Nat;
        totalReports: Nat;
        qualityScore: Float;
        lastUpdated: Time.Time;
    };
}