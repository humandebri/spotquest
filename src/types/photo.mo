import Time "mo:base/Time";
import Principal "mo:base/Principal";

module {
    public type PhotoId = Nat;
    
    public type PhotoMeta = {
        lat: Float;
        lon: Float;
        azim: Float;
        ts: Time.Time;
        ver: Blob;
        qual: Float;
        owner: Principal;
        uploadedAt: Time.Time;
        fileSize: Nat;
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
}