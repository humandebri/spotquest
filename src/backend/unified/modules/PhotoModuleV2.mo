import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Text "mo:base/Text";
import Float "mo:base/Float";
import Option "mo:base/Option";
import Random "mo:base/Random";
import Blob "mo:base/Blob";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Hash "mo:base/Hash";
// StableBuffer is not needed

import PhotoTypes "../../../types/photo";
import Constants "Constants";
import Helpers "Helpers";

module {
    // ======================================
    // 型定義
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

    /// 拡張されたPhoto型
    public type Photo = {
        // 基本情報
        id: Nat;
        owner: Principal;
        uploadTime: Time.Time;
        
        // 位置情報
        latitude: Float;
        longitude: Float;
        azimuth: ?Float;        // 方位角（撮影方向）
        geoHash: GeoHash;       // 検索用GeoHash
        
        // 表示用メタデータ
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        
        // 検索属性
        country: CountryCode;
        region: RegionCode;
        sceneKind: SceneKind;
        tags: [Text];           // 正規化済み小文字タグ
        
        // 画像チャンク情報
        chunkCount: Nat;
        totalSize: Nat;         // バイト単位
        uploadState: ChunkUploadState;
        
        // 内部管理
        status: { #Active; #Banned; #Deleted };
        qualityScore: Float;
        timesUsed: Nat;
        lastUsedTime: ?Time.Time;
    };

    /// 写真統計情報（別管理）
    public type PhotoStats = {
        totalScore: Nat;      // 累計得点
        averageScore: Float;  // 平均得点
        bestScore: Nat;       // 最高得点
        worstScore: Nat;      // 最低得点
        playCount: Nat;       // プレイ回数
    };

    /// チャンクデータ
    public type PhotoChunk = {
        photoId: Nat;
        chunkIndex: Nat;
        data: Blob;
        size: Nat;
    };

    /// 写真作成リクエスト
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
        photos: [Photo];
        totalCount: Nat;
        cursor: ?Nat;
        hasMore: Bool;
    };

    /// 全体統計情報
    public type OverallPhotoStats = {
        totalPhotos: Nat;
        activePhotos: Nat;
        totalSize: Nat;
        photosByCountry: [(CountryCode, Nat)];
        photosByRegion: [(RegionCode, Nat)];
        photosBySceneKind: [(SceneKind, Nat)];
        popularTags: [(Text, Nat)];
    };

    // DEPRECATED: 予約投稿システム削除のため - 互換性のためのダミー型
    public type ScheduledPhoto = {
        id: Nat;
        photoMeta: { latitude: Float; longitude: Float; };
        imageChunks: [Blob];
        scheduledPublishTime: Time.Time;
        status: { #pending; #published; #cancelled; #failed };
        title: Text;
        description: Text;
        difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
        hint: Text;
        tags: [Text];
        createdAt: Time.Time;
        updatedAt: Time.Time;
    };
    

    // ======================================
    // PhotoManagerクラス
    // ======================================
    public class PhotoManager() {
        // ✨ Stableストレージ（永続化） - var変数で管理（main.moからstable restore）
        private var stablePhotosEntries : [(Nat, Photo)] = [];
        private var stablePhotoChunksEntries : [(Text, PhotoChunk)] = [];
        private var stablePhotoStatsEntries : [(Nat, PhotoStats)] = [];
        
        // TrieMapでのアクセス（自動復元）
        private var stablePhotos = TrieMap.fromEntries<Nat, Photo>(stablePhotosEntries.vals(), Nat.equal, Hash.hash);
        private var stablePhotoChunks = TrieMap.fromEntries<Text, PhotoChunk>(stablePhotoChunksEntries.vals(), Text.equal, Text.hash);
        private var stablePhotoStats = TrieMap.fromEntries<Nat, PhotoStats>(stablePhotoStatsEntries.vals(), Nat.equal, Hash.hash);
        
        private var nextPhotoId : Nat = 1;
        
        // セカンダリインデックス（検索用）
        private var idxByCountry = TrieMap.TrieMap<CountryCode, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
        private var idxByRegion = TrieMap.TrieMap<RegionCode, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
        private var idxBySceneKind = TrieMap.TrieMap<Text, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
        private var idxByTag = TrieMap.TrieMap<Text, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
        private var idxByGeoHash = TrieMap.TrieMap<GeoHash, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
        private var idxByOwner = TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
        
        // アップロード進行状況
        private var uploadingSessions = TrieMap.TrieMap<Nat, {
            expectedChunks: Nat;
            receivedChunks: Buffer.Buffer<Nat>;
            startTime: Time.Time;
        }>(Nat.equal, Hash.hash);
        
        // 統計情報
        private var totalPhotos : Nat = 0;
        private var totalStorageSize : Nat = 0;
        
        
        // ======================================
        // PUBLIC FUNCTIONS
        // ======================================
        
        /// 写真のメタデータを作成（チャンクアップロード開始）
        public func createPhoto(request: CreatePhotoRequest, owner: Principal) : Result.Result<Nat, Text> {
            // 入力検証
            if (not Helpers.isValidLatitude(request.latitude)) {
                return #err("Invalid latitude");
            };
            
            if (not Helpers.isValidLongitude(request.longitude)) {
                return #err("Invalid longitude");
            };
            
            if (request.expectedChunks == 0) {
                return #err("Expected chunks must be greater than 0");
            };
            
            if (request.totalSize == 0) {
                return #err("Total size must be greater than 0");
            };
            
            // ユーザーの写真数制限チェック
            let userPhotos = getUserPhotoIds(owner);
            if (userPhotos.size() >= Constants.MAX_PHOTOS_PER_USER) {
                return #err("Upload limit reached");
            };
            
            let photoId = nextPhotoId;
            let now = Time.now();
            
            // GeoHashを計算
            let geoHash = calculateGeoHash(request.latitude, request.longitude, 8);
            
            // タグを正規化
            let normalizedTags = Array.map<Text, Text>(request.tags, func(tag) = Text.toLowercase(tag));
            
            // 新しい写真を作成
            let newPhoto : Photo = {
                id = photoId;
                owner = owner;
                uploadTime = now;
                
                latitude = request.latitude;
                longitude = request.longitude;
                azimuth = request.azimuth;
                geoHash = geoHash;
                
                title = request.title;
                description = request.description;
                difficulty = request.difficulty;
                hint = request.hint;
                
                country = request.country;
                region = request.region;
                sceneKind = request.sceneKind;
                tags = normalizedTags;
                
                chunkCount = request.expectedChunks;
                totalSize = request.totalSize;
                uploadState = #Incomplete;
                
                status = #Active;
                qualityScore = 0.5;
                timesUsed = 0;
                lastUsedTime = null;
            };
            
            // ✨ NEW: Stableストレージに保存（永続化）
            stablePhotos.put(photoId, newPhoto);
            
            // インデックスを更新
            updateIndices(newPhoto);
            
            // アップロードセッションを開始
            uploadingSessions.put(photoId, {
                expectedChunks = request.expectedChunks;
                receivedChunks = Buffer.Buffer<Nat>(request.expectedChunks);
                startTime = now;
            });
            
            nextPhotoId += 1;
            totalPhotos += 1;
            
            #ok(photoId)
        };
        
        /// チャンクをアップロード
        public func uploadPhotoChunk(photoId: Nat, chunkIndex: Nat, data: Blob) : Result.Result<(), Text> {
            // 写真の存在確認（並行システム対応）
            switch (getPhoto(photoId)) {
                case null { return #err("Photo not found") };
                case (?photo) {
                    if (photo.uploadState == #Complete) {
                        return #err("Photo upload already completed");
                    };
                    
                    // アップロードセッションの確認
                    switch (uploadingSessions.get(photoId)) {
                        case null { return #err("No upload session found") };
                        case (?session) {
                            if (chunkIndex >= session.expectedChunks) {
                                return #err("Invalid chunk index");
                            };
                            
                            // 重複チェック（並行システム対応）
                            let chunkKey = Nat.toText(photoId) # ":" # Nat.toText(chunkIndex);
                            if (getPhotoChunk(photoId, chunkIndex) != null) {
                                return #err("Chunk already uploaded");
                            };
                            
                            // チャンクを保存
                            let chunk : PhotoChunk = {
                                photoId = photoId;
                                chunkIndex = chunkIndex;
                                data = data;
                                size = data.size();
                            };
                            
                            // ✨ NEW: Stableストレージに保存（永続化）
                            stablePhotoChunks.put(chunkKey, chunk);
                            session.receivedChunks.add(chunkIndex);
                            totalStorageSize += data.size();
                            
                            #ok()
                        };
                    };
                };
            };
        };
        
        /// アップロードを完了
        public func finalizePhotoUpload(photoId: Nat) : Result.Result<(), Text> {
            switch (getPhoto(photoId)) {
                case null { return #err("Photo not found") };
                case (?photo) {
                    if (photo.uploadState == #Complete) {
                        return #err("Photo already finalized");
                    };
                    
                    switch (uploadingSessions.get(photoId)) {
                        case null { return #err("No upload session found") };
                        case (?session) {
                            // 全チャンクが揃っているか確認
                            if (session.receivedChunks.size() != session.expectedChunks) {
                                return #err("Not all chunks uploaded. Expected: " # 
                                    Nat.toText(session.expectedChunks) # ", Received: " # 
                                    Nat.toText(session.receivedChunks.size()));
                            };
                            
                            // 写真の状態を更新
                            let updatedPhoto = {
                                photo with
                                uploadState = #Complete;
                            };
                            
                            stablePhotos.put(photoId, updatedPhoto);
                            uploadingSessions.delete(photoId);
                            
                            #ok()
                        };
                    };
                };
            };
        };
        
        /// 検索API
        public func search(filter: SearchFilter, cursor: ?Nat, limit: Nat) : SearchResult {
            var candidates = Buffer.Buffer<Nat>(1000);
            var firstFilter = true;
            
            // 国フィルター
            switch (filter.country) {
                case null { };
                case (?country) {
                    switch (idxByCountry.get(country)) {
                        case null { 
                            return { photos = []; totalCount = 0; cursor = null; hasMore = false };
                        };
                        case (?ids) {
                            if (firstFilter) {
                                for (id in ids.vals()) { candidates.add(id) };
                                firstFilter := false;
                            } else {
                                candidates := intersectBuffers(candidates, ids);
                            };
                        };
                    };
                };
            };
            
            // 地域フィルター
            switch (filter.region) {
                case null { };
                case (?region) {
                    switch (idxByRegion.get(region)) {
                        case null {
                            return { photos = []; totalCount = 0; cursor = null; hasMore = false };
                        };
                        case (?ids) {
                            if (firstFilter) {
                                for (id in ids.vals()) { candidates.add(id) };
                                firstFilter := false;
                            } else {
                                candidates := intersectBuffers(candidates, ids);
                            };
                        };
                    };
                };
            };
            
            // シーンタイプフィルター
            switch (filter.sceneKind) {
                case null { };
                case (?sceneKind) {
                    let sceneKey = sceneKindToText(sceneKind);
                    switch (idxBySceneKind.get(sceneKey)) {
                        case null {
                            return { photos = []; totalCount = 0; cursor = null; hasMore = false };
                        };
                        case (?ids) {
                            if (firstFilter) {
                                for (id in ids.vals()) { candidates.add(id) };
                                firstFilter := false;
                            } else {
                                candidates := intersectBuffers(candidates, ids);
                            };
                        };
                    };
                };
            };
            
            // タグフィルター
            switch (filter.tags) {
                case null { };
                case (?tags) {
                    for (tag in tags.vals()) {
                        let normalizedTag = Text.toLowercase(tag);
                        switch (idxByTag.get(normalizedTag)) {
                            case null {
                                return { photos = []; totalCount = 0; cursor = null; hasMore = false };
                            };
                            case (?ids) {
                                if (firstFilter) {
                                    for (id in ids.vals()) { candidates.add(id) };
                                    firstFilter := false;
                                } else {
                                    candidates := intersectBuffers(candidates, ids);
                                };
                            };
                        };
                    };
                };
            };
            
            // オーナーフィルター
            switch (filter.owner) {
                case null { };
                case (?owner) {
                    switch (idxByOwner.get(owner)) {
                        case null {
                            return { photos = []; totalCount = 0; cursor = null; hasMore = false };
                        };
                        case (?ids) {
                            if (firstFilter) {
                                for (id in ids.vals()) { candidates.add(id) };
                                firstFilter := false;
                            } else {
                                candidates := intersectBuffers(candidates, ids);
                            };
                        };
                    };
                };
            };
            
            // フィルターが何も指定されていない場合は全件対象
            if (firstFilter) {
                // 新ストレージから検索（stablePhotosのみ）
                for ((id, photo) in stablePhotos.entries()) {
                    if (photo.status == #Active and photo.uploadState == #Complete) {
                        candidates.add(id);
                    };
                };
            };
            
            // 近傍検索フィルター（後処理）
            switch (filter.nearLocation) {
                case null { };
                case (?location) {
                    let filtered = Buffer.Buffer<Nat>(candidates.size());
                    for (id in candidates.vals()) {
                        switch (getPhoto(id)) {
                            case null { };
                            case (?photo) {
                                let distance = calculateDistance(
                                    location.latitude, location.longitude,
                                    photo.latitude, photo.longitude
                                );
                                if (distance <= location.radiusKm) {
                                    filtered.add(id);
                                };
                            };
                        };
                    };
                    candidates := filtered;
                };
            };
            
            // 難易度フィルター（後処理）
            switch (filter.difficulty) {
                case null { };
                case (?difficulty) {
                    let filtered = Buffer.Buffer<Nat>(candidates.size());
                    for (id in candidates.vals()) {
                        switch (getPhoto(id)) {
                            case null { };
                            case (?photo) {
                                if (photo.difficulty == difficulty) {
                                    filtered.add(id);
                                };
                            };
                        };
                    };
                    candidates := filtered;
                };
            };
            
            // ステータスフィルター（後処理）
            switch (filter.status) {
                case null { };
                case (?status) {
                    let filtered = Buffer.Buffer<Nat>(candidates.size());
                    for (id in candidates.vals()) {
                        switch (getPhoto(id)) {
                            case null { };
                            case (?photo) {
                                if (photo.status == status) {
                                    filtered.add(id);
                                };
                            };
                        };
                    };
                    candidates := filtered;
                };
            };
            
            // カーソルベースのページング
            let candidateArray = Buffer.toArray(candidates);
            let totalCount = candidateArray.size();
            
            let startIdx = switch (cursor) {
                case null { 0 };
                case (?c) { c };
            };
            
            let endIdx = Nat.min(startIdx + limit, totalCount);
            let pageIds = Iter.toArray(Array.slice(candidateArray, startIdx, endIdx));
            
            // IDから写真を取得
            let photoResults = Array.mapFilter<Nat, Photo>(pageIds, func(id) : ?Photo = getPhoto(id));
            
            {
                photos = photoResults;
                totalCount = totalCount;
                cursor = if (endIdx < totalCount) { ?endIdx } else { null };
                hasMore = endIdx < totalCount;
            }
        };
        
        /// 写真を取得
        public func getPhoto(photoId: Nat) : ?Photo {
            stablePhotos.get(photoId)
        };
        
        /// 写真のチャンクを取得
        public func getPhotoChunk(photoId: Nat, chunkIndex: Nat) : ?PhotoChunk {
            let chunkKey = Nat.toText(photoId) # ":" # Nat.toText(chunkIndex);
            stablePhotoChunks.get(chunkKey)
        };
        
        /// 写真を削除
        public func deletePhoto(photoId: Nat, requestor: Principal) : Result.Result<(), Text> {
            switch (stablePhotos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    if (photo.owner != requestor) {
                        return #err("Unauthorized");
                    };
                    
                    // ソフトデリート
                    let deletedPhoto = {
                        photo with
                        status = #Deleted;
                    };
                    
                    stablePhotos.put(photoId, deletedPhoto);
                    
                    // インデックスから削除
                    removeFromIndices(photo);
                    
                    #ok()
                };
            }
        };
        
        /// ランダムな写真を取得（ゲーム用）
        public func getRandomPhoto() : ?Photo {
            var activePhotos = Buffer.Buffer<Photo>(100);
            
            // アクティブで完了した写真を収集
            // 新ストレージから
            for ((id, photo) in stablePhotos.entries()) {
                if (photo.status == #Active and photo.uploadState == #Complete) {
                    activePhotos.add(photo);
                };
            };
            // 新ストレージから
            for ((id, photo) in stablePhotos.entries()) {
                if (photo.status == #Active and photo.uploadState == #Complete) {
                    activePhotos.add(photo);
                };
            };
            
            let photoCount = activePhotos.size();
            if (photoCount == 0) {
                return null;
            };
            
            // より良いランダム性のために複数の要素を組み合わせる
            let now = Time.now();
            let seed = Int.abs(now);
            
            // 時間をナノ秒とマイクロ秒に分割してより多様性を持たせる
            let nanoComponent = seed % 1000;
            let microComponent = (seed / 1000) % 1000;
            let milliComponent = (seed / 1000000) % 1000;
            
            // 複数の要素を組み合わせてインデックスを生成
            let randomIndex = (nanoComponent + microComponent + milliComponent + photoCount) % photoCount;
            ?activePhotos.get(randomIndex)
        };
        
        /// 写真情報を更新
        public func updatePhotoInfo(photoId: Nat, requestor: Principal, updateInfo: {
            title: Text;
            description: Text;
            difficulty: { #EASY; #NORMAL; #HARD; #EXTREME };
            hint: Text;
            tags: [Text];
        }) : Result.Result<(), Text> {
            switch (stablePhotos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    if (photo.owner != requestor) {
                        return #err("Unauthorized");
                    };
                    
                    if (photo.status == #Deleted) {
                        return #err("Photo is deleted");
                    };
                    
                    // タグを正規化
                    let normalizedTags = Array.map<Text, Text>(updateInfo.tags, func(tag) = Text.toLowercase(tag));
                    
                    // 古いインデックスから削除
                    removeFromIndices(photo);
                    
                    // 写真を更新
                    let updatedPhoto = {
                        photo with
                        title = updateInfo.title;
                        description = updateInfo.description;
                        difficulty = updateInfo.difficulty;
                        hint = updateInfo.hint;
                        tags = normalizedTags;
                    };
                    
                    stablePhotos.put(photoId, updatedPhoto);
                    
                    // 新しいインデックスに追加
                    updateIndices(updatedPhoto);
                    
                    #ok()
                };
            }
        };
        
        /// 統計情報を取得
        public func getPhotoStats() : OverallPhotoStats {
            var activePhotos = 0;
            var countryStats = TrieMap.TrieMap<CountryCode, Nat>(Text.equal, Text.hash);
            var regionStats = TrieMap.TrieMap<RegionCode, Nat>(Text.equal, Text.hash);
            var sceneStats = TrieMap.TrieMap<Text, Nat>(Text.equal, Text.hash);
            var tagStats = TrieMap.TrieMap<Text, Nat>(Text.equal, Text.hash);
            
            // ヘルパー関数：写真統計を更新
            let updateStats = func(photo: Photo) {
                if (photo.status == #Active and photo.uploadState == #Complete) {
                    activePhotos += 1;
                    
                    // 国別統計
                    switch (countryStats.get(photo.country)) {
                        case null { countryStats.put(photo.country, 1) };
                        case (?count) { countryStats.put(photo.country, count + 1) };
                    };
                    
                    // 地域別統計
                    switch (regionStats.get(photo.region)) {
                        case null { regionStats.put(photo.region, 1) };
                        case (?count) { regionStats.put(photo.region, count + 1) };
                    };
                    
                    // シーン別統計
                    let sceneKey = sceneKindToText(photo.sceneKind);
                    switch (sceneStats.get(sceneKey)) {
                        case null { sceneStats.put(sceneKey, 1) };
                        case (?count) { sceneStats.put(sceneKey, count + 1) };
                    };
                    
                    // タグ統計
                    for (tag in photo.tags.vals()) {
                        switch (tagStats.get(tag)) {
                            case null { tagStats.put(tag, 1) };
                            case (?count) { tagStats.put(tag, count + 1) };
                        };
                    };
                };
            };
            
            // 🔄 並行システム: Stable写真から統計収集
            for ((id, photo) in stablePhotos.entries()) {
                updateStats(photo);
            };
            
            
            {
                totalPhotos = totalPhotos;
                activePhotos = activePhotos;
                totalSize = totalStorageSize;
                photosByCountry = Iter.toArray(countryStats.entries());
                photosByRegion = Iter.toArray(regionStats.entries());
                photosBySceneKind = Array.map<(Text, Nat), (SceneKind, Nat)>(
                    Iter.toArray(sceneStats.entries()),
                    func((key, count)) = (textToSceneKind(key), count)
                );
                popularTags = Array.take(
                    Array.sort(
                        Iter.toArray(tagStats.entries()),
                        func(a: (Text, Nat), b: (Text, Nat)) : { #less; #equal; #greater } {
                            if (a.1 > b.1) { #less } else if (a.1 < b.1) { #greater } else { #equal }
                        }
                    ),
                    10
                );
            }
        };
        
        /// 写真の統計を更新（ゲーム結果を反映）
        public func updatePhotoStats(photoId: Nat, score: Nat) : Result.Result<(), Text> {
            switch (stablePhotos.get(photoId)) {
                case null { #err("Photo not found") };
                case (?photo) {
                    // 写真の基本情報を更新（timesUsed, lastUsedTime）
                    let updatedPhoto = {
                        photo with
                        timesUsed = photo.timesUsed + 1;
                        lastUsedTime = ?Time.now();
                    };
                    stablePhotos.put(photoId, updatedPhoto);
                    
                    // 別途統計情報を更新
                    let currentStats = switch (stablePhotoStats.get(photoId)) {
                        case null {
                            {
                                totalScore = score;
                                averageScore = Float.fromInt(score);
                                bestScore = score;
                                worstScore = score;
                                playCount = 1;
                            }
                        };
                        case (?stats) {
                            let newPlayCount = stats.playCount + 1;
                            let newTotalScore = stats.totalScore + score;
                            let newAverageScore = Float.fromInt(newTotalScore) / Float.fromInt(newPlayCount);
                            let newBestScore = Nat.max(stats.bestScore, score);
                            let newWorstScore = Nat.min(stats.worstScore, score);
                            
                            {
                                totalScore = newTotalScore;
                                averageScore = newAverageScore;
                                bestScore = newBestScore;
                                worstScore = newWorstScore;
                                playCount = newPlayCount;
                            }
                        };
                    };
                    
                    // ✨ NEW: Stableストレージに統計を保存（永続化）
                    stablePhotoStats.put(photoId, currentStats);
                    #ok()
                };
            }
        };
        
        /// 個別写真の統計情報を取得
        public func getPhotoStatsById(photoId: Nat) : ?PhotoStats {
            // 🔍 Stableから統計情報を取得
            stablePhotoStats.get(photoId)
        };
        
        /// 写真の完全なデータを取得（全チャンクを結合）
        public func getCompletePhotoData(photoId: Nat) : ?Blob {
            switch (getPhoto(photoId)) {
                case null { null };
                case (?photo) {
                    // 写真がアクティブで完了していることを確認
                    if (photo.status != #Active or photo.uploadState != #Complete) {
                        return null;
                    };
                    
                    // 全チャンクを収集
                    let chunks = Buffer.Buffer<Blob>(photo.chunkCount);
                    
                    for (i in Iter.range(0, photo.chunkCount - 1)) {
                        switch (getPhotoChunk(photoId, i)) {
                            case null { 
                                // チャンクが見つからない場合はnullを返す
                                return null;
                            };
                            case (?chunk) {
                                chunks.add(chunk.data);
                            };
                        };
                    };
                    
                    // 全チャンクを結合
                    let totalSize = chunks.toArray().size();
                    if (totalSize == 0) {
                        return null;
                    };
                    
                    // Blobを結合するための合計サイズを計算
                    var combinedSize = 0;
                    for (chunk in chunks.vals()) {
                        combinedSize += chunk.size();
                    };
                    
                    // 結合されたデータ用の配列を作成
                    let combinedData = Array.init<Nat8>(combinedSize, 0);
                    var offset = 0;
                    
                    // 各チャンクをコピー
                    for (chunk in chunks.vals()) {
                        let chunkArray = Blob.toArray(chunk);
                        for (i in Iter.range(0, chunkArray.size() - 1)) {
                            combinedData[offset + i] := chunkArray[i];
                        };
                        offset += chunkArray.size();
                    };
                    
                    // 結合されたデータをBlobとして返す
                    ?Blob.fromArray(Array.freeze(combinedData))
                };
            }
        };
        
        // ======================================
        // PRIVATE HELPER FUNCTIONS
        // ======================================
        
        private func updateIndices(photo: Photo) {
            // 国インデックス
            switch (idxByCountry.get(photo.country)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    buffer.add(photo.id);
                    idxByCountry.put(photo.country, buffer);
                };
                case (?buffer) { buffer.add(photo.id) };
            };
            
            // 地域インデックス
            switch (idxByRegion.get(photo.region)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    buffer.add(photo.id);
                    idxByRegion.put(photo.region, buffer);
                };
                case (?buffer) { buffer.add(photo.id) };
            };
            
            // シーンタイプインデックス
            let sceneKey = sceneKindToText(photo.sceneKind);
            switch (idxBySceneKind.get(sceneKey)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    buffer.add(photo.id);
                    idxBySceneKind.put(sceneKey, buffer);
                };
                case (?buffer) { buffer.add(photo.id) };
            };
            
            // タグインデックス
            for (tag in photo.tags.vals()) {
                switch (idxByTag.get(tag)) {
                    case null {
                        let buffer = Buffer.Buffer<Nat>(10);
                        buffer.add(photo.id);
                        idxByTag.put(tag, buffer);
                    };
                    case (?buffer) { buffer.add(photo.id) };
                };
            };
            
            // GeoHashインデックス（複数の精度で保存）
            for (precision in [4, 5, 6, 7, 8].vals()) {
                let geoHashPrefix = textTake(photo.geoHash, precision);
                switch (idxByGeoHash.get(geoHashPrefix)) {
                    case null {
                        let buffer = Buffer.Buffer<Nat>(10);
                        buffer.add(photo.id);
                        idxByGeoHash.put(geoHashPrefix, buffer);
                    };
                    case (?buffer) { buffer.add(photo.id) };
                };
            };
            
            // オーナーインデックス
            switch (idxByOwner.get(photo.owner)) {
                case null {
                    let buffer = Buffer.Buffer<Nat>(10);
                    buffer.add(photo.id);
                    idxByOwner.put(photo.owner, buffer);
                };
                case (?buffer) { buffer.add(photo.id) };
            };
        };
        
        private func removeFromIndices(photo: Photo) {
            // 各インデックスから削除
            removeFromIndex(idxByCountry, photo.country, photo.id);
            removeFromIndex(idxByRegion, photo.region, photo.id);
            removeFromIndex(idxBySceneKind, sceneKindToText(photo.sceneKind), photo.id);
            
            for (tag in photo.tags.vals()) {
                removeFromIndex(idxByTag, tag, photo.id);
            };
            
            for (precision in [4, 5, 6, 7, 8].vals()) {
                let geoHashPrefix = textTake(photo.geoHash, precision);
                removeFromIndex(idxByGeoHash, geoHashPrefix, photo.id);
            };
            
            removeFromOwnerIndex(photo.owner, photo.id);
        };
        
        private func removeFromIndex(index: TrieMap.TrieMap<Text, Buffer.Buffer<Nat>>, key: Text, photoId: Nat) {
            switch (index.get(key)) {
                case null { };
                case (?buffer) {
                    let filtered = Buffer.Buffer<Nat>(buffer.size());
                    for (id in buffer.vals()) {
                        if (id != photoId) {
                            filtered.add(id);
                        };
                    };
                    if (filtered.size() > 0) {
                        index.put(key, filtered);
                    } else {
                        index.delete(key);
                    };
                };
            };
        };
        
        private func removeFromOwnerIndex(owner: Principal, photoId: Nat) {
            switch (idxByOwner.get(owner)) {
                case null { };
                case (?buffer) {
                    let filtered = Buffer.Buffer<Nat>(buffer.size());
                    for (id in buffer.vals()) {
                        if (id != photoId) {
                            filtered.add(id);
                        };
                    };
                    if (filtered.size() > 0) {
                        idxByOwner.put(owner, filtered);
                    } else {
                        idxByOwner.delete(owner);
                    };
                };
            };
        };
        
        private func getUserPhotoIds(owner: Principal) : [Nat] {
            switch (idxByOwner.get(owner)) {
                case null { [] };
                case (?buffer) { Buffer.toArray(buffer) };
            }
        };
        
        private func intersectBuffers(a: Buffer.Buffer<Nat>, b: Buffer.Buffer<Nat>) : Buffer.Buffer<Nat> {
            let result = Buffer.Buffer<Nat>(Nat.min(a.size(), b.size()));
            let bSet = TrieMap.TrieMap<Nat, Bool>(Nat.equal, Hash.hash);
            
            for (id in b.vals()) {
                bSet.put(id, true);
            };
            
            for (id in a.vals()) {
                if (bSet.get(id) != null) {
                    result.add(id);
                };
            };
            
            result
        };
        
        private func sceneKindToText(kind: SceneKind) : Text {
            switch (kind) {
                case (#Nature) { "nature" };
                case (#Building) { "building" };
                case (#Store) { "store" };
                case (#Facility) { "facility" };
                case (#Other) { "other" };
            }
        };
        
        private func textToSceneKind(text: Text) : SceneKind {
            switch (text) {
                case ("nature") { #Nature };
                case ("building") { #Building };
                case ("store") { #Store };
                case ("facility") { #Facility };
                case (_) { #Other };
            }
        };
        
        /// 文字列の先頭からn文字を取得
        private func textTake(text: Text, n: Nat) : Text {
            let chars = Text.toArray(text);
            let size = Nat.min(n, chars.size());
            let sliced = Iter.toArray(Array.slice(chars, 0, size));
            Text.fromIter(sliced.vals())
        };
        
        /// GeoHashを計算（簡易実装）
        private func calculateGeoHash(lat: Float, lon: Float, precision: Nat) : GeoHash {
            // 簡易的な実装（本番環境では適切なGeoHashライブラリを使用）
            let latStr = Float.toText(lat);
            let lonStr = Float.toText(lon);
            let combined = latStr # "," # lonStr;
            
            // プレースホルダー：実際のGeoHashアルゴリズムを実装する必要がある
            textTake(combined, precision)
        };
        
        /// Haversine公式を使用して2点間の距離を計算（km）
        private func calculateDistance(lat1: Float, lon1: Float, lat2: Float, lon2: Float) : Float {
            let R = 6371.0; // 地球の半径（km）
            let dLat = (lat2 - lat1) * 3.14159265359 / 180.0;
            let dLon = (lon2 - lon1) * 3.14159265359 / 180.0;
            
            let a = Float.sin(dLat/2) * Float.sin(dLat/2) +
                    Float.cos(lat1 * 3.14159265359 / 180.0) * 
                    Float.cos(lat2 * 3.14159265359 / 180.0) *
                    Float.sin(dLon/2) * Float.sin(dLon/2);
            
            let c = 2 * Float.arctan2(Float.sqrt(a), Float.sqrt(1-a));
            R * c
        };
        
        // ======================================
        // DATA MIGRATION FUNCTIONS
        // ======================================
        
        /// 🔄 Legacy TrieMapからStableTrieMapにデータを移行
        public func migrateLegacyToStable() : {
            photosCount: Nat;
            chunksCount: Nat;
            errors: [Text];
        } {
            var photosCount = 0;
            var chunksCount = 0;
            let errors = Buffer.Buffer<Text>(10);
            
            // 移行は既に完了済み（stablePhotosのみ使用）
            
            {
                photosCount = photosCount;
                chunksCount = chunksCount;
                errors = Buffer.toArray(errors);
            }
        };
        
        /// 🔍 移行状況を確認
        public func getMigrationStatus() : {
            legacyPhotos: Nat;
            stablePhotos: Nat;
            legacyChunks: Nat;
            stableChunks: Nat;
        } {
            {
                legacyPhotos = 0; // 旧ストレージは削除済み
                stablePhotos = stablePhotos.size();
                legacyChunks = 0; // 旧ストレージは削除済み
                stableChunks = stablePhotoChunks.size();
            }
        };
        
        /// 🗑️ 移行完了後にLegacyデータを削除
        public func clearLegacyData() : {
            clearedPhotos: Nat;
            clearedChunks: Nat;
        } {
            // 旧ストレージは既に削除済み
            let clearedPhotos = 0;
            let clearedChunks = 0;
            
            {
                clearedPhotos = clearedPhotos;
                clearedChunks = clearedChunks;
            }
        };

        // ======================================
        // STABLE STORAGE FUNCTIONS
        // ======================================
        
        public func toStable() : {
            photos: [(Nat, Photo)];
            photoChunks: [(Text, PhotoChunk)];
            nextPhotoId: Nat;
            totalPhotos: Nat;
            totalStorageSize: Nat;
            
            // インデックスは再構築可能なので保存しない（メモリ節約）
            // 必要に応じて保存することも可能
        } {
            {
                photos = Iter.toArray(stablePhotos.entries());
                photoChunks = Iter.toArray(stablePhotoChunks.entries());
                nextPhotoId = nextPhotoId;
                totalPhotos = totalPhotos;
                totalStorageSize = totalStorageSize;
            }
        };
        
        /// 写真統計データのみを取得（別stable変数用）
        public func getPhotoStatsEntries() : [(Nat, PhotoStats)] {
            Iter.toArray(stablePhotoStats.entries())
        };
        
        /// 写真統計データを復元（別stable変数から）
        public func restorePhotoStats(entries: [(Nat, PhotoStats)]) {
            stablePhotoStats := TrieMap.fromEntries(entries.vals(), Nat.equal, Hash.hash);
        };
        
        /// 🔄 preupgrade: stable変数を更新
        public func prepareUpgrade() {
            stablePhotosEntries := Iter.toArray(stablePhotos.entries());
            stablePhotoChunksEntries := Iter.toArray(stablePhotoChunks.entries());
            stablePhotoStatsEntries := Iter.toArray(stablePhotoStats.entries());
        };
        
        /// 🔄 postupgrade: TrieMapを復元
        public func restoreFromUpgrade() {
            stablePhotos := TrieMap.fromEntries<Nat, Photo>(stablePhotosEntries.vals(), Nat.equal, Hash.hash);
            stablePhotoChunks := TrieMap.fromEntries<Text, PhotoChunk>(stablePhotoChunksEntries.vals(), Text.equal, Text.hash);
            stablePhotoStats := TrieMap.fromEntries<Nat, PhotoStats>(stablePhotoStatsEntries.vals(), Nat.equal, Hash.hash);
        };
        
        public func fromStable(stableData: {
            photos: [(Nat, Photo)];
            photoChunks: [(Text, PhotoChunk)];
            nextPhotoId: Nat;
            totalPhotos: Nat;
            totalStorageSize: Nat;
        }) {
            // Restore stable photos and chunks
            stablePhotos := TrieMap.fromEntries<Nat, Photo>(stableData.photos.vals(), Nat.equal, Hash.hash);
            stablePhotoChunks := TrieMap.fromEntries<Text, PhotoChunk>(stableData.photoChunks.vals(), Text.equal, Text.hash);
            
            nextPhotoId := stableData.nextPhotoId;
            totalPhotos := stableData.totalPhotos;
            totalStorageSize := stableData.totalStorageSize;
            
            // インデックスを再構築
            rebuildIndices();
        };
        
        /// インデックスを再構築（起動時に実行）
        private func rebuildIndices() {
            // 全インデックスをクリア
            idxByCountry := TrieMap.TrieMap<CountryCode, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
            idxByRegion := TrieMap.TrieMap<RegionCode, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
            idxBySceneKind := TrieMap.TrieMap<Text, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
            idxByTag := TrieMap.TrieMap<Text, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
            idxByGeoHash := TrieMap.TrieMap<GeoHash, Buffer.Buffer<Nat>>(Text.equal, Text.hash);
            idxByOwner := TrieMap.TrieMap<Principal, Buffer.Buffer<Nat>>(Principal.equal, Principal.hash);
            
            // 全写真に対してインデックスを再構築
            for ((id, photo) in Iter.toArray(stablePhotos.entries()).vals()) {
                if (photo.status == #Active) {
                    updateIndices(photo);
                };
            };
        };
    };
}