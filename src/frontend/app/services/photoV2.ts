import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { DEBUG_CONFIG, debugLog } from '../utils/debugConfig';
import { Principal } from '@dfinity/principal';
import { CustomPrincipal } from '../utils/principal';
import { CANISTER_ID_UNIFIED } from '../constants';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = CANISTER_ID_UNIFIED;

// ======================================
// V2 Types (新しい検索対応版)
// ======================================

export type SceneKind = 
  | { Nature: null }
  | { Building: null } 
  | { Store: null }
  | { Facility: null }
  | { Other: null };


export type CountryCode = string; // 国名（例: "Japan"）
export type RegionCode = string;  // 地域名（例: "Tokyo, Japan"）
export type GeoHash = string;

export type ChunkUploadState = 
  | { Incomplete: null }
  | { Complete: null }
  | { Failed: null };

export interface CreatePhotoRequest {
  // 位置情報
  latitude: number;
  longitude: number;
  azimuth: number | null;
  
  // 表示用メタデータ
  title: string;
  description: string;
  difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  hint: string;
  
  // 検索属性
  country: CountryCode; // 正規化された国名
  region: RegionCode;   // 完全な地域名（"City, Country"形式）
  sceneKind: SceneKind;
  tags: string[];
  
  // チャンク情報
  expectedChunks: bigint;
  totalSize: bigint;
}

export interface PhotoMetaV2 {
  // 基本情報
  id: bigint;
  owner: Principal;
  uploadTime: bigint; // IDL.Int -> bigint (時間は大きな数値になる可能性があるため)
  
  // 位置情報
  latitude: number;
  longitude: number;
  azimuth: number[] | []; // IDL Optional型は配列形式
  geoHash: GeoHash;
  
  // 表示用メタデータ
  title: string;
  description: string;
  difficulty: { EASY: null } | { NORMAL: null } | { HARD: null } | { EXTREME: null };
  hint: string;
  
  // 検索属性
  country: CountryCode; // 正規化された国名
  region: RegionCode;   // 完全な地域名（"City, Country"形式）
  sceneKind: SceneKind;
  tags: string[];
  
  // 画像チャンク情報
  chunkCount: bigint;
  totalSize: bigint;
  uploadState: ChunkUploadState;
  
  // 内部管理
  status: { Active: null } | { Banned: null } | { Deleted: null };
  timesUsed: bigint;
  lastUsedTime: bigint[] | []; // IDL Optional型は配列形式 (IDL.Int -> bigint)
  
  // 統計情報は別途APIで取得
}

export interface PhotoStatsDetailsV2 {
  totalScore: bigint;      // 累計得点
  averageScore: number;    // 平均得点
  bestScore: bigint;       // 最高得点
  worstScore: bigint;      // 最低得点
  playCount: bigint;       // プレイ回数
}

export interface SearchFilter {
  country?: CountryCode;
  region?: RegionCode;
  sceneKind?: SceneKind;
  tags?: string[];
  nearLocation?: {
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  owner?: Principal;
  difficulty?: { EASY: null } | { NORMAL: null } | { HARD: null } | { EXTREME: null };
  status?: { Active: null } | { Banned: null } | { Deleted: null };
}

export interface SearchResult {
  photos: PhotoMetaV2[];
  totalCount: bigint;
  cursor: bigint | null;
  hasMore: boolean;
}

export interface OverallPhotoStatsV2 {
  totalPhotos: bigint;
  activePhotos: bigint;
  totalSize: bigint;
  photosByCountry: Array<[CountryCode, bigint]>;
  photosByRegion: Array<[RegionCode, bigint]>;
  photosBySceneKind: Array<[SceneKind, bigint]>;
  popularTags: Array<[string, bigint]>;
}

// IDLファクトリー（V2版）
const idlFactory = ({ IDL }: any) => {
  const SceneKind = IDL.Variant({
    'Nature': IDL.Null,
    'Building': IDL.Null,
    'Store': IDL.Null,
    'Facility': IDL.Null,
    'Other': IDL.Null,
  });

  const CountryCode = IDL.Text;
  const RegionCode = IDL.Text;
  const GeoHash = IDL.Text;

  const ChunkUploadState = IDL.Variant({
    'Incomplete': IDL.Null,
    'Complete': IDL.Null,
    'Failed': IDL.Null,
  });

  const CreatePhotoRequest = IDL.Record({
    latitude: IDL.Float64,
    longitude: IDL.Float64,
    azimuth: IDL.Opt(IDL.Float64),
    title: IDL.Text,
    description: IDL.Text,
    difficulty: IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    }),
    hint: IDL.Text,
    country: CountryCode,
    region: RegionCode,
    sceneKind: SceneKind,
    tags: IDL.Vec(IDL.Text),
    expectedChunks: IDL.Nat,
    totalSize: IDL.Nat,
  });

  const PhotoMetaV2 = IDL.Record({
    id: IDL.Nat,
    owner: IDL.Principal,
    uploadTime: IDL.Int,
    latitude: IDL.Float64,
    longitude: IDL.Float64,
    azimuth: IDL.Opt(IDL.Float64),
    geoHash: GeoHash,
    title: IDL.Text,
    description: IDL.Text,
    difficulty: IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    }),
    hint: IDL.Text,
    country: CountryCode,
    region: RegionCode,
    sceneKind: SceneKind,
    tags: IDL.Vec(IDL.Text),
    chunkCount: IDL.Nat,
    totalSize: IDL.Nat,
    uploadState: ChunkUploadState,
    status: IDL.Variant({
      'Active': IDL.Null,
      'Banned': IDL.Null,
      'Deleted': IDL.Null,
    }),
    timesUsed: IDL.Nat,
    lastUsedTime: IDL.Opt(IDL.Int),
  });

  const PhotoStatsDetails = IDL.Record({
    totalScore: IDL.Nat,
    averageScore: IDL.Float64,
    bestScore: IDL.Nat,
    worstScore: IDL.Nat,
    playCount: IDL.Nat,
  });

  const SearchFilter = IDL.Record({
    country: IDL.Opt(CountryCode),
    region: IDL.Opt(RegionCode),
    sceneKind: IDL.Opt(SceneKind),
    tags: IDL.Opt(IDL.Vec(IDL.Text)),
    nearLocation: IDL.Opt(IDL.Record({
      latitude: IDL.Float64,
      longitude: IDL.Float64,
      radiusKm: IDL.Float64,
    })),
    owner: IDL.Opt(IDL.Principal),
    difficulty: IDL.Opt(IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    })),
    status: IDL.Opt(IDL.Variant({
      'Active': IDL.Null,
      'Banned': IDL.Null,
      'Deleted': IDL.Null,
    })),
  });

  const SearchResult = IDL.Record({
    photos: IDL.Vec(PhotoMetaV2),
    totalCount: IDL.Nat,
    cursor: IDL.Opt(IDL.Nat),
    hasMore: IDL.Bool,
  });

  const OverallPhotoStats = IDL.Record({
    totalPhotos: IDL.Nat,
    activePhotos: IDL.Nat,
    totalSize: IDL.Nat,
    photosByCountry: IDL.Vec(IDL.Tuple(CountryCode, IDL.Nat)),
    photosByRegion: IDL.Vec(IDL.Tuple(RegionCode, IDL.Nat)),
    photosBySceneKind: IDL.Vec(IDL.Tuple(SceneKind, IDL.Nat)),
    popularTags: IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)),
  });


  const Result = IDL.Variant({
    'ok': IDL.Nat,
    'err': IDL.Text,
  });

  const ResultEmpty = IDL.Variant({
    'ok': IDL.Null,
    'err': IDL.Text,
  });

  return IDL.Service({
    createPhotoV2: IDL.Func([CreatePhotoRequest], [Result], []),
    uploadPhotoChunkV2: IDL.Func([IDL.Nat, IDL.Nat, IDL.Vec(IDL.Nat8)], [ResultEmpty], []),
    finalizePhotoUploadV2: IDL.Func([IDL.Nat], [ResultEmpty], []),
    searchPhotosV2: IDL.Func([SearchFilter, IDL.Opt(IDL.Nat), IDL.Nat], [SearchResult], ['query']),
    getPhotoMetadataV2: IDL.Func([IDL.Nat], [IDL.Opt(PhotoMetaV2)], ['query']),
    getPhotoChunkV2: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Opt(IDL.Vec(IDL.Nat8))], ['query']),
    getPhotoCompleteDataV2: IDL.Func([IDL.Nat], [IDL.Opt(IDL.Vec(IDL.Nat8))], ['query']),
    getPhotoStatsV2: IDL.Func([], [OverallPhotoStats], ['query']),
    getPhotoStatsDetailsV2: IDL.Func([IDL.Nat], [IDL.Opt(PhotoStatsDetails)], ['query']),
    getUserPhotosV2: IDL.Func([IDL.Opt(IDL.Nat), IDL.Nat], [SearchResult], ['query']),
    deletePhotoV2: IDL.Func([IDL.Nat], [ResultEmpty], []),
  });
};

class PhotoServiceV2 {
  private agent: HttpAgent | null = null;
  private actor: any = null;
  private identity: Identity | null = null;
  private photoCache: Map<string, PhotoMetaV2> = new Map();
  private chunkCache: Map<string, Uint8Array> = new Map();
  private dataUrlCache: Map<string, string> = new Map();
  private statsCache: Map<string, PhotoStatsDetailsV2> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5分のキャッシュ

  async init(identity: Identity) {
    try {
      if (!identity) {
        throw new Error('No identity provided');
      }

      // Reuse existing actor if identity hasn't changed
      if (this.identity === identity && this.actor) {
        return;
      }

      this.identity = identity;
      const host = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';
      const canisterId = UNIFIED_CANISTER_ID;
      
      debugLog('API_CALLS', '🖼️ Initializing photo service V2:', { host, canisterId });
      
      // Dev modeの確認（デバッグ用）
      const isDevMode = identity.constructor.name === 'Ed25519KeyIdentity';
      
      this.agent = new HttpAgent({
        identity,
        host: host,
        verifyQuerySignatures: true, // 署名検証を有効化（正しいプリンシパルを使用）
        // API v3を有効化して高速化
        useQueryNonces: true,
        retryTimes: 3,
        // Fetch options for timeout and performance
        fetchOptions: {
          reactNative: {
            // React Native用の最適化
            __nativeResponseType: 'base64',
          },
        },
      });

      // Dev modeの場合、追加の設定
      if (isDevMode) {
        debugLog('API_CALLS', '🖼️ Dev mode detected - certificate verification will be handled by early patches');
      }

      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: canisterId,
      });
      
      debugLog('API_CALLS', '🖼️ Photo service V2 initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize photo service V2:', error);
      throw error;
    }
  }

  /**
   * 写真の作成（チャンクアップロード開始）
   */
  async createPhoto(request: CreatePhotoRequest, identity?: Identity): Promise<{ ok?: bigint; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      // IDL variant型とOptional型用の変換を行う
      const idlRequest = {
        ...request,
        azimuth: request.azimuth !== null ? [request.azimuth] : [], // null → [] に変換
        difficulty: difficultyFromString(request.difficulty), // 文字列 → variant型に変換
      };
      
      debugLog('API_CALLS', '🖼️ Creating photo with request:', request);
      const result = await this.actor.createPhotoV2(idlRequest);
      debugLog('API_CALLS', '🖼️ Photo created:', result);
      return result;
    } catch (error) {
      console.error('❌ Create photo error:', error);
      return { err: error instanceof Error ? error.message : 'Create failed' };
    }
  }

  /**
   * チャンクをアップロード
   */
  async uploadChunk(photoId: bigint, chunkIndex: bigint, data: Uint8Array, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      console.log(`🖼️ Uploading chunk ${chunkIndex} for photo ${photoId}, size: ${data.length}`);
      const result = await this.actor.uploadPhotoChunkV2(photoId, chunkIndex, data);
      console.log('🖼️ Chunk uploaded:', result);
      return result;
    } catch (error) {
      console.error('❌ Upload chunk error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * アップロードを完了
   */
  async finalizeUpload(photoId: bigint, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      console.log(`🖼️ Finalizing upload for photo ${photoId}`);
      const result = await this.actor.finalizePhotoUploadV2(photoId);
      console.log('🖼️ Upload finalized:', result);
      return result;
    } catch (error) {
      console.error('❌ Finalize upload error:', error);
      return { err: error instanceof Error ? error.message : 'Finalize failed' };
    }
  }

  /**
   * 写真を検索
   */
  async searchPhotos(filter: SearchFilter, cursor?: bigint, limit: number = 20, identity?: Identity): Promise<SearchResult> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      console.log('🔍 Searching photos with filter:', filter);
      
      // Convert TypeScript optional fields to IDL Optional format
      const idlFilter = {
        country: filter.country ? [filter.country] : [],
        region: filter.region ? [filter.region] : [],
        sceneKind: filter.sceneKind ? [filter.sceneKind] : [],
        tags: filter.tags ? [filter.tags] : [],
        nearLocation: filter.nearLocation ? [filter.nearLocation] : [],
        owner: filter.owner ? [filter.owner] : [],
        difficulty: filter.difficulty ? [filter.difficulty] : [],
        status: filter.status ? [filter.status] : [],
      };
      
      const result = await this.actor.searchPhotosV2(idlFilter, cursor ? [cursor] : [], BigInt(limit));
      console.log(`🔍 Found ${result.photos.length} photos`);
      return result;
    } catch (error) {
      console.error('❌ Search photos error:', error);
      return {
        photos: [],
        totalCount: BigInt(0),
        cursor: null,
        hasMore: false,
      };
    }
  }

  /**
   * 週間写真を取得（過去7日間）
   */
  async getWeeklyPhotos(regionFilter?: string, limit: number = 100, identity?: Identity): Promise<SearchResult> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      console.log('📅 Getting weekly photos with region filter:', regionFilter);
      
      const result = await this.actor.getWeeklyPhotos(
        regionFilter ? [regionFilter] : [],
        BigInt(limit)
      );
      
      console.log(`📅 Found ${result.photos.length} photos from this week`);
      return result;
    } catch (error) {
      console.error('❌ Get weekly photos error:', error);
      return {
        photos: [],
        totalCount: BigInt(0),
        cursor: null,
        hasMore: false,
      };
    }
  }

  /**
   * 写真メタデータを取得（キャッシュ付き）
   */
  async getPhotoMetadata(photoId: bigint, identity?: Identity): Promise<PhotoMetaV2 | null> {
    // キャッシュをチェック
    const cacheKey = `photo_${photoId}`;
    const cached = this.photoCache.get(cacheKey);
    if (cached) {
      console.log('🚀 Photo metadata cache hit:', photoId);
      return cached;
    }

    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      debugLog('API_CALLS', '📥 Fetching photo metadata:', photoId);
      const startTime = Date.now();
      
      const result = await this.actor.getPhotoMetadataV2(photoId);
      
      const fetchTime = Date.now() - startTime;
      debugLog('API_CALLS', `📊 Photo metadata fetch time: ${fetchTime}ms`);
      
      if (result.length > 0) {
        const metadata = result[0];
        // キャッシュに保存
        this.photoCache.set(cacheKey, metadata);
        setTimeout(() => this.photoCache.delete(cacheKey), this.cacheTimeout);
        
        return metadata;
      }
      return null;
    } catch (error) {
      console.error('❌ Get photo metadata error:', error);
      return null;
    }
  }

  /**
   * 写真のチャンクを取得（キャッシュ付き）
   */
  async getPhotoChunk(photoId: bigint, chunkIndex: bigint, identity?: Identity): Promise<Uint8Array | null> {
    // キャッシュをチェック
    const cacheKey = `chunk_${photoId}_${chunkIndex}`;
    const cached = this.chunkCache.get(cacheKey);
    if (cached) {
      console.log('🚀 Photo chunk cache hit:', photoId, chunkIndex);
      return cached;
    }

    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      debugLog('API_CALLS', '📥 Fetching photo chunk:', photoId, chunkIndex);
      const startTime = Date.now();
      
      const result = await this.actor.getPhotoChunkV2(photoId, chunkIndex);
      
      const fetchTime = Date.now() - startTime;
      debugLog('API_CALLS', `📊 Photo chunk fetch time: ${fetchTime}ms`);
      
      if (result.length > 0) {
        const chunk = new Uint8Array(result[0]);
        // キャッシュに保存（チャンクは大きいので短めのタイムアウト）
        this.chunkCache.set(cacheKey, chunk);
        setTimeout(() => this.chunkCache.delete(cacheKey), this.cacheTimeout / 2);
        
        return chunk;
      }
      return null;
    } catch (error) {
      console.error('❌ Get photo chunk error:', error);
      return null;
    }
  }

  /**
   * 写真統計情報を取得
   */
  async getPhotoStats(identity?: Identity): Promise<OverallPhotoStatsV2 | null> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.getPhotoStatsV2();
      return result;
    } catch (error) {
      console.error('❌ Get photo stats error:', error);
      return null;
    }
  }

  /**
   * ユーザーの写真を取得
   */
  async getUserPhotos(cursor?: bigint, limit: number = 20, identity?: Identity): Promise<SearchResult> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      // Dev modeかどうか確認
      const isDevMode = this.identity && this.identity.constructor.name === 'Ed25519KeyIdentity';
      
      if (isDevMode) {
        console.log('🖼️ Calling getUserPhotosV2 in dev mode with principal:', this.identity?.getPrincipal().toString());
      }
      
      const result = await this.actor.getUserPhotosV2(cursor ? [cursor] : [], BigInt(limit));
      
      if (isDevMode) {
        console.log('🖼️ getUserPhotosV2 result in dev mode:', {
          photoCount: result.photos.length,
          hasMore: result.hasMore
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Get user photos error:', error);
      return {
        photos: [],
        totalCount: BigInt(0),
        cursor: null,
        hasMore: false,
      };
    }
  }

  /**
   * 写真を削除
   */
  async deletePhoto(photoId: bigint, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.deletePhotoV2(photoId);
      return result;
    } catch (error) {
      console.error('❌ Delete photo error:', error);
      return { err: error instanceof Error ? error.message : 'Delete failed' };
    }
  }

  /**
   * 写真の詳細統計情報を取得
   */
  async getPhotoStatsDetails(photoId: bigint, identity?: Identity): Promise<PhotoStatsDetailsV2 | null> {
    // キャッシュをチェック
    const cacheKey = `stats_${photoId}`;
    const cached = this.statsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      debugLog('API_CALLS', '📊 Fetching photo stats details:', photoId);
      const result = await this.actor.getPhotoStatsDetailsV2(photoId);
      if (result.length > 0) {
        const stats = result[0];
        this.statsCache.set(cacheKey, stats);
        setTimeout(() => this.statsCache.delete(cacheKey), this.cacheTimeout);
        return stats;
      }
      return null;
    } catch (error) {
      console.error('❌ Get photo stats details error:', error);
      return null;
    }
  }

  /**
   * 写真の完全なデータを取得（全チャンク結合済み）
   * Uses the backend getPhotoCompleteDataV2 method directly
   */
  async getPhotoCompleteData(photoId: bigint, identity?: Identity): Promise<Uint8Array | null> {
    // キャッシュをチェック
    const cacheKey = `complete_${photoId}`;
    const cached = this.chunkCache.get(cacheKey);
    if (cached) {
      debugLog('API_CALLS', '🚀 Complete photo data cache hit:', photoId);
      return cached;
    }

    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      debugLog('API_CALLS', '📥 Fetching complete photo data:', photoId);
      const startTime = Date.now();
      
      // Use the backend method directly
      const result = await this.actor.getPhotoCompleteDataV2(photoId);
      
      const fetchTime = Date.now() - startTime;
      
      if (result.length > 0) {
        const completeData = new Uint8Array(result[0]);
        debugLog('API_CALLS', `📊 Complete photo data fetch time: ${fetchTime}ms, size: ${completeData.length} bytes`);
        
        // キャッシュに保存
        this.chunkCache.set(cacheKey, completeData);
        setTimeout(() => this.chunkCache.delete(cacheKey), this.cacheTimeout);
        
        return completeData;
      }
      
      console.log('❌ No photo data found for ID:', photoId);
      return null;
    } catch (error) {
      console.error('❌ Get complete photo data error:', error);
      return null;
    }
  }

  /**
   * 写真データURL（base64）を取得（高速変換＋キャッシュ付き）
   */
  async getPhotoDataUrl(photoId: bigint, identity?: Identity): Promise<string | null> {
    const cacheKey = `dataurl_${photoId}`;
    const cached = this.dataUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const completeData = await this.getPhotoCompleteData(photoId, identity);
    if (!completeData) return null;

    // 判定：すでにテキスト（dataURLやBase64文字列）が返ってきているか
    const decoder = new TextDecoder();
    const head = completeData.slice(0, Math.min(100, completeData.length));
    const headText = decoder.decode(head);

    let dataUrl: string;
    if (headText.includes('data:image')) {
      // dataURLのテキストとして返ってきている
      const asText = decoder.decode(completeData);
      dataUrl = asText;
    } else if (/^[A-Za-z0-9+/]/.test(headText)) {
      // Base64テキストとして返ってきている
      const base64String = decoder.decode(completeData);
      dataUrl = base64String.startsWith('data:')
        ? base64String
        : `data:image/jpeg;base64,${base64String}`;
    } else {
      // バイナリ -> Base64 高速変換
      const base64 = uint8ToBase64(completeData);
      dataUrl = `data:image/jpeg;base64,${base64}`;
    }

    this.dataUrlCache.set(cacheKey, dataUrl);
    setTimeout(() => this.dataUrlCache.delete(cacheKey), this.cacheTimeout);
    return dataUrl;
  }


  /**
   * 3段階アップロードヘルパー
   */
  async uploadPhotoWithChunks(
    data: {
      imageData: string; // Base64
      metadata: CreatePhotoRequest;
    },
    identity?: Identity,
    onProgress?: (progress: number) => void
  ): Promise<{ ok?: bigint; err?: string }> {
    try {
      // 1. 写真を作成
      const createResult = await this.createPhoto(data.metadata, identity);
      if (createResult.err) {
        return createResult;
      }
      
      const photoId = createResult.ok!;
      console.log(`🖼️ Created photo with ID: ${photoId}`);
      
      // 2. チャンクに分割してアップロード
      const CHUNK_SIZE = 256 * 1024; // 256KB
      const base64Data = data.imageData;
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkBytes = new TextEncoder().encode(chunkData);
        
        const uploadResult = await this.uploadChunk(photoId, BigInt(i), chunkBytes, identity);
        if (uploadResult.err) {
          return { err: `Chunk ${i} upload failed: ${uploadResult.err}` };
        }
        
        if (onProgress) {
          onProgress((i + 1) / totalChunks);
        }
      }
      
      // 3. アップロードを完了
      const finalizeResult = await this.finalizeUpload(photoId, identity);
      if (finalizeResult.err) {
        return { err: `Finalize failed: ${finalizeResult.err}` };
      }
      
      console.log(`🖼️ Successfully uploaded photo ${photoId}`);
      return { ok: photoId };
      
    } catch (error) {
      console.error('❌ Upload photo with chunks error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }
}

export const photoServiceV2 = new PhotoServiceV2();

// ヘルパー関数
export function sceneKindFromString(scene: string): SceneKind {
  switch (scene.toLowerCase()) {
    case 'nature': return { Nature: null };
    case 'building': return { Building: null };
    case 'store': return { Store: null };
    case 'facility': return { Facility: null };
    default: return { Other: null };
  }
}

export function sceneKindToString(kind: SceneKind): string {
  if ('Nature' in kind) return 'nature';
  if ('Building' in kind) return 'building';
  if ('Store' in kind) return 'store';
  if ('Facility' in kind) return 'facility';
  return 'other';
}

export function difficultyFromString(diff: string): { EASY: null } | { NORMAL: null } | { HARD: null } | { EXTREME: null } {
  switch (diff.toUpperCase()) {
    case 'EASY': return { EASY: null };
    case 'NORMAL': return { NORMAL: null };
    case 'HARD': return { HARD: null };
    case 'EXTREME': return { EXTREME: null };
    default: return { NORMAL: null };
  }
}

// 高速な Uint8Array -> Base64 変換（大きな配列に対応）
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB チャンク
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    // Hermes では apply に TypedArray は直接渡せない場合があるため Array に変換
    binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  return btoa(binary);
}

// 画像URIをBase64に変換するヘルパー関数
export async function imageUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // data:image/jpeg;base64, を除去
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 画像URIをBlobに変換するヘルパー関数
export async function imageUriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

// BlobをUint8Arrayに変換するヘルパー関数（React Native対応）
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to convert blob to ArrayBuffer'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}



// 地域情報を取得するヘルパー関数（簡素化版）
export async function getRegionInfo(latitude: number, longitude: number): Promise<{ country: string; region: string }> {
  try {
    console.log('🌍 Getting region info for coordinates:', { latitude, longitude });
    
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=en`;
    console.log('🌍 Region info URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SpotQuestApp/2.0 (https://spotquest.app; contact@spotquest.app)',
        'Accept': 'application/json',
        'Accept-Language': 'en',
      },
    });
    
    console.log('🌍 Region info response status:', response.status);
    
    if (!response.ok) {
      console.error('🌍 Region info request failed with status:', response.status);
      const text = await response.text();
      console.error('🌍 Response text:', text.substring(0, 200));
      throw new Error(`Geocoding request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🌍 Region info response data:', JSON.stringify(data, null, 2));
    const address = data.address || {};
    
    // 新しい簡素化されたアプローチ: 英語地域名をそのまま使用
    const { formatLocationName, normalizeCountryName } = await import('../utils/regionMapping');
    
    const locationName = formatLocationName(address);
    
    // 国名を正規化
    const countryName = normalizeCountryName(address.country || 'Unknown');
    
    console.log('🌍 Simplified geocoding result:', {
      locationName,
      countryName,
      fullAddress: data.display_name,
    });
    
    return { 
      country: countryName, 
      region: locationName 
    };
    
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    
    // フォールバック: 座標から大まかな地域を推定
    let fallbackCountry = 'Unknown';
    let fallbackRegion = 'Unknown Location';
    
    // 北米の大まかな範囲
    if (latitude >= 25 && latitude <= 70 && longitude >= -170 && longitude <= -50) {
      if (latitude >= 49) {
        fallbackCountry = 'Canada';
      } else if (latitude >= 30) {
        fallbackCountry = 'United States';
      } else {
        fallbackCountry = 'Mexico';
      }
      
      // アメリカの主要都市の範囲
      if (fallbackCountry === 'United States') {
        if (latitude >= 37 && latitude <= 38 && longitude >= -123 && longitude <= -122) {
          fallbackRegion = 'San Francisco, United States';
        } else if (latitude >= 40.5 && latitude <= 41 && longitude >= -74.5 && longitude <= -73.5) {
          fallbackRegion = 'New York, United States';
        } else if (latitude >= 33.5 && latitude <= 34.5 && longitude >= -118.5 && longitude <= -117.5) {
          fallbackRegion = 'Los Angeles, United States';
        } else {
          fallbackRegion = `${fallbackCountry} (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
        }
      }
    }
    // 日本の大まかな範囲
    else if (latitude >= 30 && latitude <= 46 && longitude >= 129 && longitude <= 146) {
      fallbackCountry = 'Japan';
      if (latitude >= 35.5 && latitude <= 36 && longitude >= 139.5 && longitude <= 140) {
        fallbackRegion = 'Tokyo, Japan';
      } else if (latitude >= 34.5 && latitude <= 35 && longitude >= 135 && longitude <= 136) {
        fallbackRegion = 'Osaka, Japan';
      } else {
        fallbackRegion = `Japan (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
      }
    }
    
    console.log('📍 Using fallback location:', { country: fallbackCountry, region: fallbackRegion });
    return { country: fallbackCountry, region: fallbackRegion };
  }
}

export default photoServiceV2;
