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
    
    // 予約投稿関連の型定義
    public type ScheduledPhoto = {
        id: Nat;
        photoMeta: PhotoMeta;
        imageChunks: [PhotoChunk];
        scheduledPublishTime: Time.Time;
        status: {
            #pending;
            #published;
            #cancelled;
        };
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        tags: [Text];
        createdAt: Time.Time;
        updatedAt: Time.Time;
    };
    
    public type PhotoUploadRequest = {
        meta: PhotoMeta;
        totalChunks: Nat;
        scheduledPublishTime: ?Time.Time; // null = 即時公開
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        tags: [Text];
    };
    
    // 通知システム用の型
    public type Notification = {
        id: Nat;
        userId: Principal;
        notificationType: { 
            #scheduledPhotoPublished;
            #scheduledPhotoFailed;
            #scheduledPhotoReminder;
        };
        photoId: Nat;
        message: Text;
        timestamp: Time.Time;
        read: Bool;
    };
    
    // 統計情報用の型
    public type SchedulingStats = {
        totalScheduled: Nat;
        avgScheduleDelay: Nat; // 分単位
        popularScheduleTimes: [(Nat, Nat)]; // (時間, 件数)
        cancellationRate: Float;
    };
}