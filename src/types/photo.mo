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
    
    // ======================================
    // V2 Types (新しい検索対応版)
    // ======================================
    
    /// シーンの種類を表す列挙型
    public type SceneKind = { 
        #Nature;    // 自然
        #Building;  // 建物
        #Store;     // 店舗
        #Facility;  // 施設
        #Other;     // その他
    };

    /// 地域コード (例: "JP-15" for 新潟県)
    public type RegionCode = Text;
    
    /// 国コード (ISO-3166-1 alpha-2, 例: "JP")
    public type CountryCode = Text;
    
    /// GeoHashコード (位置情報の階層的エンコーディング)
    public type GeoHash = Text;

    /// チャンクアップロード状態
    public type ChunkUploadState = {
        #Incomplete;
        #Complete;
        #Failed;
    };
    
    /// 写真作成リクエストV2
    public type CreatePhotoRequest = {
        // 位置情報
        latitude: Float;
        longitude: Float;
        azimuth: ?Float;
        
        // 表示用メタデータ
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        
        // 検索属性
        country: CountryCode;
        region: RegionCode;
        sceneKind: SceneKind;
        tags: [Text];
        
        // チャンク情報
        expectedChunks: Nat;
        totalSize: Nat;
    };
    
    /// チャンクアップロードリクエストV2
    public type ChunkUploadRequestV2 = {
        photoId: PhotoId;
        chunkIndex: Nat;
        data: Blob;
    };
    
    /// 検索フィルター
    public type SearchFilter = {
        country: ?CountryCode;
        region: ?RegionCode;
        sceneKind: ?SceneKind;
        tags: ?[Text];
        nearLocation: ?{
            latitude: Float;
            longitude: Float;
            radiusKm: Float;
        };
        owner: ?Principal;
        difficulty: ?{ #EASY; #NORMAL; #HARD; #EXTREME };
        status: ?{ #Active; #Banned; #Deleted };
    };

    /// 検索結果
    public type SearchResult = {
        photos: [PhotoMetaV2];
        totalCount: Nat;
        cursor: ?Nat;
        hasMore: Bool;
    };
    
    /// 拡張された写真メタデータV2
    public type PhotoMetaV2 = {
        // 基本情報
        id: Nat;
        owner: Principal;
        uploadTime: Time.Time;
        
        // 位置情報
        latitude: Float;
        longitude: Float;
        azimuth: ?Float;
        geoHash: GeoHash;
        
        // 表示用メタデータ
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        
        // 検索属性
        country: CountryCode;
        region: RegionCode;
        sceneKind: SceneKind;
        tags: [Text];
        
        // 画像チャンク情報
        chunkCount: Nat;
        totalSize: Nat;
        uploadState: ChunkUploadState;
        
        // 内部管理
        status: { #Active; #Banned; #Deleted };
        timesUsed: Nat;
        lastUsedTime: ?Time.Time;
        
        // 評価情報（オプション - 後方互換性のため）
        aggregatedRatings: ?{
            difficulty: { total: Nat; count: Nat; average: Float };
            interest: { total: Nat; count: Nat; average: Float };
            beauty: { total: Nat; count: Nat; average: Float };
            lastUpdated: Time.Time;
        };
    };
    
    /// 写真統計情報V2
    public type PhotoStatsV2 = {
        totalPhotos: Nat;
        activePhotos: Nat;
        totalSize: Nat;
        photosByCountry: [(CountryCode, Nat)];
        photosBySceneKind: [(SceneKind, Nat)];
        popularTags: [(Text, Nat)];
    };
}