import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { CustomPrincipal } from '../utils/principal';
import { CANISTER_ID_UNIFIED } from '../constants';

// メインネット統合Canister ID設定
const UNIFIED_CANISTER_ID = CANISTER_ID_UNIFIED;

// Import types and service from photoV2
import { CreatePhotoRequest, PhotoMetaV2, sceneKindFromString, difficultyFromString, photoServiceV2 } from './photoV2';

class PhotoServiceV2Direct {
  // PhotoServiceV2Directは既存のphotoServiceV2をラップして使用

  /**
   * 写真を真の「直接アップロード」で送信
   * 単一チャンクとして画像全体をアップロード（チャンク分割なし）
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

      console.log('🚀 Direct uploading photo (single chunk), size:', data.imageData.length, 'bytes');
      
      // ICPの2MB制限チェック
      const MAX_ICP_SIZE = 2 * 1024 * 1024; // 2MB
      if (data.imageData.length > MAX_ICP_SIZE) {
        return { 
          err: `画像サイズが${(data.imageData.length / 1024 / 1024).toFixed(2)}MBでICPの2MB制限を超えています。画質を下げて再試行してください。` 
        };
      }
      
      // 1. 写真を作成（単一チャンクとして設定）
      const createRequest: CreatePhotoRequest = {
        ...data.metadata,
        expectedChunks: BigInt(1), // 単一チャンクに固定
        totalSize: BigInt(data.imageData.length), // 正確なサイズ
      };
      
      const createResult = await photoServiceV2.createPhoto(createRequest, identity);
      if (createResult.err) {
        return createResult;
      }
      
      const photoId = createResult.ok!;
      console.log(`🚀 Created photo with ID: ${photoId} (single chunk mode)`);
      
      // 2. 画像データ全体を1つのチャンクとしてアップロード（chunkIndex: 0）
      const uploadResult = await photoServiceV2.uploadChunk(
        photoId, 
        BigInt(0), // chunkIndex: 0（最初で最後のチャンク）
        data.imageData, // Uint8Arrayを直接使用
        identity
      );
      
      if (uploadResult.err) {
        return { err: `Single chunk upload failed: ${uploadResult.err}` };
      }
      
      console.log('🚀 Single chunk uploaded successfully');
      
      // 3. アップロードを完了
      const finalizeResult = await photoServiceV2.finalizeUpload(photoId, identity);
      if (finalizeResult.err) {
        return { err: `Finalize failed: ${finalizeResult.err}` };
      }
      
      console.log(`🚀 Successfully uploaded photo ${photoId} via direct upload`);
      return { ok: photoId };
      
    } catch (error) {
      console.error('❌ Direct upload error:', error);
      return { err: error instanceof Error ? error.message : 'Upload failed' };
    }
  }
}

export const photoServiceV2Direct = new PhotoServiceV2Direct();