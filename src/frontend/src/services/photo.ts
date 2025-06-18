import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
// Import CustomPrincipal as a fallback if needed
import { CustomPrincipal } from '../utils/principal';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

// 写真データ型定義
export interface PhotoUploadData {
  imageData: string; // Base64エンコードされた画像データ
  latitude: number;
  longitude: number;
  azimuth: number;
  title: string;
  description: string;
  difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  hint: string;
  tags: string[];
  timestamp: bigint;
  scheduledPublishTime: bigint | null;
}

export interface PhotoMetadata {
  id: bigint;
  owner: Principal;
  lat: number;
  lon: number;
  azim: number;
  timestamp: bigint;
  quality: number;
  uploadTime: bigint;
  chunkCount: bigint;
  totalSize: bigint;
  perceptualHash: string | null;
  title?: string;
  description?: string;
  difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  hint?: string;
  tags?: string[];
}

export interface PhotoUpdateInfo {
  title: string;
  description: string;
  difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  hint: string;
  tags: string[];
}

export interface ScheduledPhoto {
  id: bigint;
  photoMeta: PhotoMetadata;
  imageChunks: Array<{
    photoId: bigint;
    chunkIndex: bigint;
    data: Uint8Array;
  }>;
  scheduledPublishTime: bigint;
  status: { pending: null } | { published: null } | { cancelled: null };
  title: string;
  description: string;
  difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  hint: string;
  tags: string[];
  createdAt: bigint;
  updatedAt: bigint;
}

// IDLファクトリー（簡易版）
const idlFactory = ({ IDL }: any) => {
  const PhotoMetadata = IDL.Record({
    id: IDL.Nat,
    owner: IDL.Principal,
    lat: IDL.Float64,
    lon: IDL.Float64,
    azim: IDL.Float64,
    timestamp: IDL.Nat,
    quality: IDL.Float64,
    uploadTime: IDL.Nat,
    chunkCount: IDL.Nat,
    totalSize: IDL.Nat,
    perceptualHash: IDL.Opt(IDL.Text),
  });

  const PhotoUploadRequest = IDL.Record({
    meta: PhotoMetadata,
    totalChunks: IDL.Nat,
    scheduledPublishTime: IDL.Opt(IDL.Nat),
    title: IDL.Text,
    description: IDL.Text,
    difficulty: IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    }),
    hint: IDL.Text,
    tags: IDL.Vec(IDL.Text),
  });

  const Result = IDL.Variant({
    'ok': IDL.Nat,
    'err': IDL.Text,
  });

  const ScheduledUploadRequest = IDL.Record({
    uploadRequest: PhotoUploadRequest,
    scheduledTime: IDL.Int, // Time.Time in Motoko is Int
    notificationType: IDL.Variant({
      'scheduledPhotoPublished': IDL.Null,
      'scheduledPhotoFailed': IDL.Null,
      'scheduledPhotoReminder': IDL.Null,
    }),
  });

  const ScheduledPhoto = IDL.Record({
    id: IDL.Nat,
    photoMeta: PhotoMetadata,
    imageChunks: IDL.Vec(IDL.Record({ photoId: IDL.Nat, chunkIndex: IDL.Nat, data: IDL.Vec(IDL.Nat8) })),
    scheduledPublishTime: IDL.Nat,
    status: IDL.Variant({
      'pending': IDL.Null,
      'published': IDL.Null,
      'cancelled': IDL.Null,
    }),
    title: IDL.Text,
    description: IDL.Text,
    difficulty: IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    }),
    hint: IDL.Text,
    tags: IDL.Vec(IDL.Text),
    createdAt: IDL.Nat,
    updatedAt: IDL.Nat,
  });

  // Photo V2 types
  const PhotoMetaV2 = IDL.Record({
    id: IDL.Nat,
    owner: IDL.Principal,
    uploadTime: IDL.Nat,
    latitude: IDL.Float64,
    longitude: IDL.Float64,
    azimuth: IDL.Opt(IDL.Float64),
    geoHash: IDL.Text,
    title: IDL.Text,
    description: IDL.Text,
    difficulty: IDL.Variant({
      'EASY': IDL.Null,
      'NORMAL': IDL.Null,
      'HARD': IDL.Null,
      'EXTREME': IDL.Null,
    }),
    hint: IDL.Text,
    country: IDL.Text,
    region: IDL.Text,
    sceneKind: IDL.Text,
    tags: IDL.Vec(IDL.Text),
    chunkCount: IDL.Nat,
    totalSize: IDL.Nat,
    uploadState: IDL.Variant({
      'Uploading': IDL.Null,
      'Completed': IDL.Null,
      'Failed': IDL.Null,
    }),
    status: IDL.Variant({
      'Active': IDL.Null,
      'Banned': IDL.Null,
      'Deleted': IDL.Null,
    }),
    qualityScore: IDL.Float64,
    timesUsed: IDL.Nat,
    lastUsedTime: IDL.Opt(IDL.Nat),
  });

  return IDL.Service({
    uploadPhoto: IDL.Func([PhotoUploadRequest], [Result], []),
    schedulePhotoUpload: IDL.Func([ScheduledUploadRequest], [Result], []),
    cancelScheduledPhoto: IDL.Func([IDL.Nat], [IDL.Variant({ 'ok': IDL.Null, 'err': IDL.Text })], []),
    getUserScheduledPhotos: IDL.Func([], [IDL.Vec(ScheduledPhoto)], ['query']),
    getPhotoMetadata: IDL.Func([IDL.Nat], [IDL.Opt(PhotoMetadata)], ['query']),
    getUserPhotos: IDL.Func([], [IDL.Vec(PhotoMetadata)], ['query']),
    updatePhotoInfo: IDL.Func([IDL.Nat, IDL.Record({
      title: IDL.Text,
      description: IDL.Text,
      difficulty: IDL.Variant({ 'EASY': IDL.Null, 'NORMAL': IDL.Null, 'HARD': IDL.Null, 'EXTREME': IDL.Null }),
      hint: IDL.Text,
      tags: IDL.Vec(IDL.Text),
    })], [IDL.Variant({ 'ok': IDL.Null, 'err': IDL.Text })], []),
    deletePhoto: IDL.Func([IDL.Nat], [IDL.Variant({ 'ok': IDL.Null, 'err': IDL.Text })], []),
    // V2 methods
    getPhotoMetadataV2: IDL.Func([IDL.Nat], [IDL.Opt(PhotoMetaV2)], ['query']),
    getPhotoChunkV2: IDL.Func([IDL.Nat, IDL.Nat], [IDL.Opt(IDL.Vec(IDL.Nat8))], ['query']),
  });
};

class PhotoService {
  private agent: HttpAgent | null = null;
  private actor: any = null;
  private identity: Identity | null = null;

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
      
      console.log('Initializing photo service:', { host, canisterId });
      
      this.agent = new HttpAgent({
        identity,
        host: host,
        // 署名検証を有効化（正しいプリンシパルを使用）
        verifyQuerySignatures: true,
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


      // fetchRootKeyはローカルレプリカでのみ実行（mainnetでは不要）
      // mainnetを使用しているため、fetchRootKeyは実行しない
      // if (process.env.NODE_ENV === 'development') {
      //   await this.agent.fetchRootKey();
      // }

      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: canisterId,
      });
      
      console.log('Photo service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize photo service:', error);
      throw error;
    }
  }

  async uploadPhoto(data: PhotoUploadData, identity?: Identity): Promise<{ ok?: bigint; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      // 画像データをチャンクに分割（256KB chunks）
      const CHUNK_SIZE = 256 * 1024;
      const chunks: string[] = [];
      const base64Data = data.imageData;
      
      for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
        chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
      }

      console.log(`Uploading photo with ${chunks.length} chunks`);

      // Get the principal from the identity passed to this method
      let ownerPrincipal;
      try {
        if (identity) {
          const rawPrincipal = identity.getPrincipal();
          // Check if we need to convert it to a proper Principal object
          if (rawPrincipal && typeof rawPrincipal.toText === 'function') {
            ownerPrincipal = rawPrincipal;
          } else if (rawPrincipal && typeof rawPrincipal.toString === 'function') {
            // Convert string representation to Principal
            ownerPrincipal = Principal.fromText(rawPrincipal.toString());
          } else {
            console.warn('Invalid principal from identity, using anonymous');
            ownerPrincipal = Principal.anonymous();
          }
        } else {
          ownerPrincipal = Principal.anonymous();
        }
      } catch (error) {
        console.error('Error getting principal from identity:', error);
        ownerPrincipal = Principal.anonymous();
      }
      console.log('Using owner principal:', ownerPrincipal.toString());

      // IMPORTANT: Always convert to CustomPrincipal for React Native compatibility
      // The @dfinity/principal may not serialize correctly in React Native
      try {
        const principalText = ownerPrincipal.toText ? ownerPrincipal.toText() : ownerPrincipal.toString();
        console.log('Converting to CustomPrincipal, text:', principalText);
        
        // Always use CustomPrincipal for consistent serialization
        ownerPrincipal = CustomPrincipal.fromText(principalText);
        console.log('Successfully created CustomPrincipal:', ownerPrincipal.toString());
        console.log('CustomPrincipal type check:', ownerPrincipal.constructor.name);
      } catch (err) {
        console.error('Failed to create CustomPrincipal:', err);
        // Fallback to anonymous if conversion fails
        ownerPrincipal = CustomPrincipal.fromText('2vxsx-fae'); // Anonymous principal
      }

      // IDLで定義されたPhotoUploadRequest形式に合わせてデータを送信
      const uploadRequest = {
        meta: {
          id: BigInt(0), // サーバー側で設定される
          owner: ownerPrincipal,
          lat: data.latitude,
          lon: data.longitude,
          azim: data.azimuth,
          timestamp: data.timestamp,
          quality: 1.0,
          uploadTime: BigInt(Date.now() * 1000000), // ナノ秒
          chunkCount: BigInt(chunks.length),
          totalSize: BigInt(base64Data.length),
          perceptualHash: [],
        },
        totalChunks: BigInt(chunks.length),
        scheduledPublishTime: data.scheduledPublishTime ? [data.scheduledPublishTime] : [],
        title: data.title,
        description: data.description,
        difficulty: { [data.difficulty]: null },
        hint: data.hint,
        tags: data.tags,
      };

      console.log('Sending upload request:', uploadRequest);
      console.log('Owner principal details:', {
        ownerToString: ownerPrincipal.toString(),
        ownerToText: ownerPrincipal.toText(),
        ownerType: typeof ownerPrincipal,
        ownerConstructor: ownerPrincipal.constructor.name,
        ownerBytes: ownerPrincipal.toUint8Array ? ownerPrincipal.toUint8Array() : 'No toUint8Array method'
      });

      // Check if this is a scheduled upload or immediate upload
      if (data.scheduledPublishTime && data.scheduledPublishTime > 0) {
        // Convert milliseconds to nanoseconds (multiply by 1,000,000)
        const scheduledTimeNanos = data.scheduledPublishTime * BigInt(1000000);
        
        // Ensure the scheduled time is in the future
        const nowNanos = BigInt(Date.now()) * BigInt(1000000);
        if (scheduledTimeNanos <= nowNanos) {
          return { err: 'Scheduled time must be in the future' };
        }

        // Wrap in ScheduledUploadRequest format
        const scheduledUploadRequest = {
          uploadRequest: uploadRequest,
          scheduledTime: scheduledTimeNanos,
          notificationType: { 'scheduledPhotoPublished': null }
        };
        
        console.log('Sending scheduled upload request:', scheduledUploadRequest);
        console.log('Scheduled time comparison:', {
          scheduledTimeNanos: scheduledTimeNanos.toString(),
          nowNanos: nowNanos.toString(),
          isInFuture: scheduledTimeNanos > nowNanos
        });

        // Use scheduled upload API
        const result = await this.actor.schedulePhotoUpload(scheduledUploadRequest);
        return result;
      } else {
        // Use immediate upload API for non-scheduled uploads
        console.log('Using immediate upload (no scheduled time)');
        const result = await this.actor.uploadPhoto(uploadRequest);
        return result;
      }
    } catch (error) {
      console.error('Upload photo error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async cancelScheduledPhoto(photoId: bigint, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.cancelScheduledPhoto(photoId);
      return result;
    } catch (error) {
      console.error('Cancel scheduled photo error:', error);
      return { err: error instanceof Error ? error.message : 'Cancel failed' };
    }
  }

  async getUserScheduledPhotos(identity?: Identity): Promise<ScheduledPhoto[]> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.getUserScheduledPhotos();
      return result;
    } catch (error) {
      console.error('Get scheduled photos error:', error);
      return [];
    }
  }

  async getPhotoMetadata(photoId: bigint, identity?: Identity): Promise<PhotoMetadata | null> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.getPhotoMetadata(photoId);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Get photo metadata error:', error);
      return null;
    }
  }

  async getUserPhotos(identity?: Identity): Promise<PhotoMetadata[]> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.getUserPhotos();
      return result;
    } catch (error) {
      console.error('Get user photos error:', error);
      return [];
    }
  }

  async updatePhotoInfo(photoId: bigint, updateInfo: PhotoUpdateInfo, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.updatePhotoInfo(photoId, {
        title: updateInfo.title,
        description: updateInfo.description,
        difficulty: { [updateInfo.difficulty]: null },
        hint: updateInfo.hint,
        tags: updateInfo.tags,
      });
      return result;
    } catch (error) {
      console.error('Update photo info error:', error);
      return { err: error instanceof Error ? error.message : 'Update failed' };
    }
  }

  async deletePhoto(photoId: bigint, identity?: Identity): Promise<{ ok?: null; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      const result = await this.actor.deletePhoto(photoId);
      return result;
    } catch (error) {
      console.error('Delete photo error:', error);
      return { err: error instanceof Error ? error.message : 'Delete failed' };
    }
  }

  // V2 methods for SessionDetailsScreen
  async getPhotoMetadataV2(photoId: number): Promise<any | null> {
    if (!this.actor) {
      console.error('Photo service not initialized');
      return null;
    }

    try {
      const result = await this.actor.getPhotoMetadataV2(BigInt(photoId));
      return result;
    } catch (error) {
      console.error('Get photo metadata V2 error:', error);
      return null;
    }
  }

  async getPhotoChunkV2(photoId: number, chunkIndex: number): Promise<Uint8Array | null> {
    if (!this.actor) {
      console.error('Photo service not initialized');
      return null;
    }

    try {
      const result = await this.actor.getPhotoChunkV2(BigInt(photoId), BigInt(chunkIndex));
      return result;
    } catch (error) {
      console.error('Get photo chunk V2 error:', error);
      return null;
    }
  }

  async getPhotoDataUrl(photoId: number): Promise<string | null> {
    if (!this.actor) {
      console.error('Photo service not initialized');
      return null;
    }

    try {
      // First get metadata to know how many chunks there are
      const metadata = await this.getPhotoMetadataV2(photoId);
      if (!metadata) {
        console.error('Photo metadata not found');
        return null;
      }

      // Fetch all chunks
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < Number(metadata.chunkCount); i++) {
        const chunk = await this.getPhotoChunkV2(photoId, i);
        if (chunk) {
          chunks.push(chunk);
        }
      }

      if (chunks.length === 0) {
        console.error('No photo chunks found');
        return null;
      }

      // Combine chunks into single array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // BufferでUint8ArrayからBase64に簡単に変換
      const base64 = Buffer.from(combined).toString('base64');
      
      // ローカルファイルに保存
      const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`;
      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('📷 Photo saved to local cache:', localUri);
      
      // file://パスを返す（Data-URIのサイズ制限を回避）
      return localUri;
    } catch (error) {
      console.error('Get photo data URL error:', error);
      return null;
    }
  }

  // 画像データをBase64に変換するヘルパー関数
  static async imageUriToBase64(uri: string): Promise<string> {
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
}

export const photoService = new PhotoService();

// 画像URIをBase64に変換するヘルパー関数をエクスポート
export const imageUriToBase64 = PhotoService.imageUriToBase64;

// Nominatim 逆ジオコーディング関数
export const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1&accept-language=en`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GuessTheSpotApp/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Received non-JSON response from geocoding API:', text.substring(0, 200));
      throw new Error('Invalid response format from geocoding API');
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // 住所コンポーネントから詳細な情報を抽出
    const address = data.address;
    const addressParts = [];
    
    // 最も具体的な場所から順に追加
    // 市区町村レベル
    if (address.city) {
      addressParts.push(address.city);
    } else if (address.town) {
      addressParts.push(address.town);
    } else if (address.village) {
      addressParts.push(address.village);
    } else if (address.municipality) {
      addressParts.push(address.municipality);
    } else if (address.county) {
      addressParts.push(address.county);
    }
    
    // 都道府県・州・地域レベル
    if (address.state) {
      addressParts.push(address.state);
    } else if (address.province) {
      addressParts.push(address.province);
    } else if (address.region) {
      addressParts.push(address.region);
    } else if (address.state_district) {
      addressParts.push(address.state_district);
    }
    
    // 国
    if (address.country) {
      addressParts.push(address.country);
    }
    
    // フォールバック: 表示名から抽出
    if (addressParts.length === 0 && data.display_name) {
      const displayParts = data.display_name.split(',').map(part => part.trim());
      // 最初の3つの要素を取得（通常は市区町村、都道府県、国の順）
      addressParts.push(...displayParts.slice(0, 3));
    }
    
    return addressParts.length > 0 ? addressParts.join(', ') : 'Address not found';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw new Error('Failed to get address');
  }
};

// 本番環境用のエクスポート
export default photoService;