import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const MAX_FILE_SIZE = 1.8 * 1024 * 1024; // 1.8MB (バイナリアップロード用: ICPの2MB制限内)

/**
 * 画像を1.8MB以下に圧縮する（バイナリアップロード対応）
 * バイナリ形式で直接アップロードするため、Base64の33%オーバーヘッドなし
 * @param uri 画像のURI
 * @returns 圧縮された画像のURI
 */
export async function compressImageAsync(uri: string): Promise<{ uri: string; compressed: boolean; originalSize: number; compressedSize: number }> {
  try {
    // 元のファイルサイズを取得
    const originalInfo = await FileSystem.getInfoAsync(uri);
    const originalSize = originalInfo.exists && 'size' in originalInfo ? originalInfo.size : 0;
    
    console.log('🖼️ Original image size:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
    
    // 1.8MB以下の場合は圧縮不要
    if (originalSize <= MAX_FILE_SIZE) {
      console.log('✅ Image is already under 1.8MB, no compression needed');
      return { 
        uri, 
        compressed: false, 
        originalSize, 
        compressedSize: originalSize 
      };
    }
    
    console.log('🔧 Image exceeds 1.8MB, starting compression...');
    
    // 元画像の情報を取得
    const originalImageInfo = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log(`📐 Original image dimensions: ${originalImageInfo.width}x${originalImageInfo.height}`);
    
    let compressQuality = 0.9;
    let resizedUri = uri;
    let attempts = 0;
    const maxAttempts = 10;
    
    // 初回は幅を1920pxに制限（Full HD相当）、ただし元画像がそれより小さい場合は元のサイズを使用
    let targetWidth = Math.min(1920, originalImageInfo.width);
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Compression attempt ${attempts}: quality=${compressQuality}, width=${targetWidth}`);
      
      // アスペクト比を保持したリサイズ
      // heightに大きな値を設定することで、アスペクト比に基づいて自動調整される
      const manipulated = await ImageManipulator.manipulateAsync(
        resizedUri,
        [{ 
          resize: { 
            width: targetWidth,
            height: 10000 // 十分に大きな値を設定（アスペクト比に基づいて自動調整される）
          } 
        }],
        { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const fileInfo = await FileSystem.getInfoAsync(manipulated.uri);
      const currentSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      
      console.log(`📊 Compressed size: ${(currentSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📐 Image dimensions: ${manipulated.width}x${manipulated.height}`);
      
      if (currentSize <= MAX_FILE_SIZE) {
        console.log(`✅ Successfully compressed to ${(currentSize / 1024 / 1024).toFixed(2)} MB (${Math.round((1 - currentSize / originalSize) * 100)}% reduction)`);
        return { 
          uri: manipulated.uri, 
          compressed: true, 
          originalSize, 
          compressedSize: currentSize 
        };
      }
      
      // 次の試行のために調整
      resizedUri = manipulated.uri;
      
      // 品質を段階的に下げる
      if (compressQuality > 0.5) {
        compressQuality -= 0.1;
      } else if (targetWidth > 1024) {
        // 品質が0.5以下になったら、画像サイズを小さくする
        targetWidth = Math.floor(targetWidth * 0.8);
        compressQuality = 0.7; // 品質をリセット
      } else {
        // それでもダメなら、より積極的に圧縮
        compressQuality -= 0.05;
        targetWidth = Math.floor(targetWidth * 0.9);
      }
      
      // 最小値の制限（品質を上げて画像の劣化を防ぐ）
      if (compressQuality < 0.3) {
        compressQuality = 0.3; // 最低でも30%の品質を保つ
      }
      if (targetWidth < 800) {
        targetWidth = 800; // 最小幅を800pxに上げる
      }
    }
    
    // 最大試行回数に達した場合、最後の圧縮結果を返す
    console.warn('⚠️ Maximum compression attempts reached, using last result');
    const finalInfo = await FileSystem.getInfoAsync(resizedUri);
    const finalSize = finalInfo.exists && 'size' in finalInfo ? finalInfo.size : originalSize;
    
    return { 
      uri: resizedUri, 
      compressed: true, 
      originalSize, 
      compressedSize: finalSize 
    };
    
  } catch (error) {
    console.error('❌ Image compression error:', error);
    throw new Error('画像の圧縮に失敗しました');
  }
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  else return (bytes / 1048576).toFixed(2) + ' MB';
}