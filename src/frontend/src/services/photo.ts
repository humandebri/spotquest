import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { authService } from './auth';

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

  return IDL.Service({
    uploadPhoto: IDL.Func([PhotoUploadRequest], [Result], []),
    schedulePhotoUpload: IDL.Func([PhotoUploadRequest], [Result], []),
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
  });
};

class PhotoService {
  private agent: HttpAgent | null = null;
  private actor: any = null;

  async init() {
    try {
      const host = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';
      const canisterId = UNIFIED_CANISTER_ID;
      
      console.log('Initializing photo service:', { host, canisterId });
      
      this.agent = new HttpAgent({
        host: host,
      });

      // メインネットに接続する場合、fetchRootKeyは不要
      // if (__DEV__) {
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

  async uploadPhoto(data: PhotoUploadData): Promise<{ ok?: bigint; err?: string }> {
    if (!this.actor) {
      await this.init();
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

      // IDLで定義されたPhotoUploadRequest形式に合わせてデータを送信
      const uploadRequest = {
        meta: {
          id: BigInt(0), // サーバー側で設定される
          owner: this.agent?.getPrincipal() || Principal.anonymous(),
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

      // Canisterに送信（予約投稿APIを使用）
      const result = await this.actor.schedulePhotoUpload(uploadRequest);

      return result;
    } catch (error) {
      console.error('Upload photo error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async cancelScheduledPhoto(photoId: bigint): Promise<{ ok?: null; err?: string }> {
    if (!this.actor) {
      await this.init();
    }

    try {
      const result = await this.actor.cancelScheduledPhoto(photoId);
      return result;
    } catch (error) {
      console.error('Cancel scheduled photo error:', error);
      return { err: error instanceof Error ? error.message : 'Cancel failed' };
    }
  }

  async getUserScheduledPhotos(): Promise<ScheduledPhoto[]> {
    if (!this.actor) {
      await this.init();
    }

    try {
      const result = await this.actor.getUserScheduledPhotos();
      return result;
    } catch (error) {
      console.error('Get scheduled photos error:', error);
      return [];
    }
  }

  async getPhotoMetadata(photoId: bigint): Promise<PhotoMetadata | null> {
    if (!this.actor) {
      await this.init();
    }

    try {
      const result = await this.actor.getPhotoMetadata(photoId);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Get photo metadata error:', error);
      return null;
    }
  }

  async getUserPhotos(): Promise<PhotoMetadata[]> {
    if (!this.actor) {
      await this.init();
    }

    try {
      const result = await this.actor.getUserPhotos();
      return result;
    } catch (error) {
      console.error('Get user photos error:', error);
      return [];
    }
  }

  async updatePhotoInfo(photoId: bigint, updateInfo: PhotoUpdateInfo): Promise<{ ok?: null; err?: string }> {
    if (!this.actor) {
      await this.init();
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

  async deletePhoto(photoId: bigint): Promise<{ ok?: null; err?: string }> {
    if (!this.actor) {
      await this.init();
    }

    try {
      const result = await this.actor.deletePhoto(photoId);
      return result;
    } catch (error) {
      console.error('Delete photo error:', error);
      return { err: error instanceof Error ? error.message : 'Delete failed' };
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