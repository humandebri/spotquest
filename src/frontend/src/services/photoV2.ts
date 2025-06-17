import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { CustomPrincipal } from '../utils/principal';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

// ======================================
// V2 Types (新しい検索対応版)
// ======================================

export type SceneKind = 
  | { Nature: null }
  | { Building: null } 
  | { Store: null }
  | { Facility: null }
  | { Other: null };


export type CountryCode = string; // ISO-3166-1 alpha-2 (例: "JP")
export type RegionCode = string;  // ISO-3166-2 (例: "JP-15")
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
  country: CountryCode;
  region: RegionCode;
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
  uploadTime: bigint;
  
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
  country: CountryCode;
  region: RegionCode;
  sceneKind: SceneKind;
  tags: string[];
  
  // 画像チャンク情報
  chunkCount: bigint;
  totalSize: bigint;
  uploadState: ChunkUploadState;
  
  // 内部管理
  status: { Active: null } | { Banned: null } | { Deleted: null };
  qualityScore: number;
  timesUsed: bigint;
  lastUsedTime: bigint[] | []; // IDL Optional型は配列形式
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

export interface PhotoStatsV2 {
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
    qualityScore: IDL.Float64,
    timesUsed: IDL.Nat,
    lastUsedTime: IDL.Opt(IDL.Int),
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

  const PhotoStatsV2 = IDL.Record({
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
    getPhotoStatsV2: IDL.Func([], [PhotoStatsV2], ['query']),
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
      
      console.log('🖼️ Initializing photo service V2:', { host, canisterId });
      
      this.agent = new HttpAgent({
        identity,
        host: host,
        verifyQuerySignatures: false, // dev環境では証明書検証をスキップ
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

      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: canisterId,
      });
      
      console.log('🖼️ Photo service V2 initialized successfully');
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
      
      console.log('🖼️ Creating photo with request:', request);
      const result = await this.actor.createPhotoV2(idlRequest);
      console.log('🖼️ Photo created:', result);
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
      const result = await this.actor.searchPhotosV2(filter, cursor ? [cursor] : [], BigInt(limit));
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
      console.log('📥 Fetching photo metadata:', photoId);
      const startTime = Date.now();
      
      const result = await this.actor.getPhotoMetadataV2(photoId);
      
      const fetchTime = Date.now() - startTime;
      console.log(`📊 Photo metadata fetch time: ${fetchTime}ms`);
      
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
      console.log('📥 Fetching photo chunk:', photoId, chunkIndex);
      const startTime = Date.now();
      
      const result = await this.actor.getPhotoChunkV2(photoId, chunkIndex);
      
      const fetchTime = Date.now() - startTime;
      console.log(`📊 Photo chunk fetch time: ${fetchTime}ms`);
      
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
  async getPhotoStats(identity?: Identity): Promise<PhotoStatsV2 | null> {
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
      const result = await this.actor.getUserPhotosV2(cursor ? [cursor] : [], BigInt(limit));
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

// 地域情報を取得するヘルパー関数
export async function getRegionInfo(latitude: number, longitude: number): Promise<{ country: CountryCode; region: RegionCode }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=en`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GuessTheSpotApp/2.0',
      },
    });
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    const data = await response.json();
    const address = data.address || {};
    
    // 国コードを取得
    const countryCode = address.country_code?.toUpperCase() || 'XX';
    
    // 地域コードを生成（ISO-3166-2形式を目指す）
    let regionCode = countryCode;
    if (address.state || address.province || address.region) {
      const regionName = address.state || address.province || address.region;
      // 簡易的な地域コード生成（実際のISO-3166-2コードは別途マッピングが必要）
      regionCode = `${countryCode}-${regionName.substring(0, 2).toUpperCase()}`;
    }
    
    return { country: countryCode, region: regionCode };
    
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return { country: 'XX', region: 'XX-XX' };
  }
}

export default photoServiceV2;