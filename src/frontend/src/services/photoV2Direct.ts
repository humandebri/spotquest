import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { CustomPrincipal } from '../utils/principal';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

// Import types from photoV2
import { CreatePhotoRequest, PhotoMetaV2, sceneKindFromString, difficultyFromString } from './photoV2';

// IDLファクトリー（直接アップロード版）
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

  const Result = IDL.Variant({
    'ok': IDL.Nat,
    'err': IDL.Text,
  });

  return IDL.Service({
    // 直接アップロード用のメソッド（予約投稿APIを流用）
    schedulePhotoUploadV2: IDL.Func([CreatePhotoRequest, IDL.Vec(IDL.Nat8), IDL.Int], [Result], []),
  });
};

class PhotoServiceV2Direct {
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
      
      console.log('🚀 Initializing direct photo service:', { host, canisterId });
      
      this.agent = new HttpAgent({
        identity,
        host: host,
        verifyQuerySignatures: false,
        useQueryNonces: true,
        retryTimes: 3,
        fetchOptions: {
          reactNative: {
            __nativeResponseType: 'base64',
          },
        },
      });

      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: canisterId,
      });
      
      console.log('🚀 Direct photo service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize direct photo service:', error);
      throw error;
    }
  }

  /**
   * 写真を直接アップロード（チャンク処理なし）
   * 1.8MB以下に圧縮済みの画像データを想定
   * 
   * @param data.imageData - Uint8Array形式の画像データ（Base64から移行済み）
   * @param data.metadata - 写真のメタデータ
   */
  async uploadPhotoDirect(
    data: {
      imageData: Uint8Array; // バイナリデータ（Base64から移行）
      metadata: CreatePhotoRequest;
    },
    identity?: Identity
  ): Promise<{ ok?: bigint; err?: string }> {
    if (!this.actor && identity) {
      await this.init(identity);
    }

    try {
      // Uint8Arrayを直接使用
      const bytes = data.imageData;

      // IDL variant型とOptional型用の変換を行う
      const idlRequest = {
        ...data.metadata,
        azimuth: data.metadata.azimuth !== null ? [data.metadata.azimuth] : [],
        difficulty: difficultyFromString(data.metadata.difficulty),
        expectedChunks: BigInt(1), // 単一アップロードなので1チャンク
        totalSize: BigInt(bytes.length),
      };
      
      console.log('🚀 Direct uploading photo, size:', bytes.length, 'bytes');
      
      // 即座にアップロード（現在時刻から10秒後に設定）
      // ネットワーク遅延を考慮して10秒のマージンを設ける
      const now = Date.now(); // ミリ秒
      const immediatePublishTime = (now + 10000) * 1_000_000; // 10秒後をナノ秒で (ミリ秒 * 1,000,000 = ナノ秒)
      
      console.log('🚀 Scheduling upload for:', new Date(now + 10000).toISOString());
      console.log('🚀 Timestamp in nanoseconds:', immediatePublishTime);
      
      const result = await this.actor.schedulePhotoUploadV2(
        idlRequest,
        bytes,
        BigInt(immediatePublishTime) // 10秒後に公開
      );
      
      console.log('🚀 Direct upload result:', result);
      return result;
    } catch (error) {
      console.error('❌ Direct upload error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }
}

export const photoServiceV2Direct = new PhotoServiceV2Direct();