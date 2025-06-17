import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { CustomPrincipal } from '../utils/principal';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

// Import types and service from photoV2
import { CreatePhotoRequest, PhotoMetaV2, sceneKindFromString, difficultyFromString, photoServiceV2 } from './photoV2';

class PhotoServiceV2Direct {
  // PhotoServiceV2Directは既存のphotoServiceV2をラップして使用

  /**
   * 写真を直接アップロード
   * 正しいPhoto V2 APIを使用（予約投稿システム削除後）
   * 
   * @param data.imageData - Uint8Array形式の画像データ
   * @param data.metadata - 写真のメタデータ
   */
  async uploadPhotoDirect(
    data: {
      imageData: Uint8Array;
      metadata: CreatePhotoRequest;
    },
    identity?: Identity
  ): Promise<{ ok?: bigint; err?: string }> {
    try {
      // Photo V2サービスを初期化
      if (identity) {
        await photoServiceV2.init(identity);
      }

      console.log('🚀 Direct uploading photo, size:', data.imageData.length, 'bytes');
      
      // Base64に変換してuploadPhotoWithChunksメソッドを使用
      const base64Data = Array.from(data.imageData)
        .map(byte => String.fromCharCode(byte))
        .join('');
      const base64String = btoa(base64Data);
      
      const result = await photoServiceV2.uploadPhotoWithChunks(
        {
          imageData: base64String,
          metadata: data.metadata,
        },
        identity,
        (progress) => {
          console.log(`🚀 Upload progress: ${Math.round(progress * 100)}%`);
        }
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