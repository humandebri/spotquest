import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../hooks/useAuth';
import { 
  photoServiceV2,
  imageUriToBlob,
  blobToUint8Array,
  getRegionInfo,
  sceneKindFromString,
  CreatePhotoRequest,
  SceneKind
} from '../../services/photoV2';
import { photoServiceV2Direct } from '../../services/photoV2Direct';
import { reverseGeocode } from '../../services/photo'; // 一時的に旧サービスから流用
import { compressImageAsync, formatFileSize } from '../../utils/imageCompression';

type PhotoUploadScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoUpload'>;
type PhotoUploadScreenRouteProp = RouteProp<RootStackParamList, 'PhotoUpload'>;

// DateTimePickerのインポートを修正
let DateTimePicker: any;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
  console.log('DateTimePicker not available:', e);
  DateTimePicker = null;
}

const SCENE_TYPES = [
  { label: '自然', value: 'nature' },
  { label: '建物', value: 'building' },
  { label: '店舗', value: 'store' },
  { label: '施設', value: 'facility' },
  { label: 'その他', value: 'other' },
];

export default function PhotoUploadScreenV2() {
  const navigation = useNavigation<PhotoUploadScreenNavigationProp>();
  const route = useRoute<PhotoUploadScreenRouteProp>();
  const { principal, identity } = useAuth();
  const mapRef = useRef<MapView>(null);

  const { photoUri, latitude, longitude: rawLongitude, azimuth, timestamp } = route.params;
  
  // 西半球の座標修正（暫定的な対処）
  // アメリカ大陸（おおよそ西経20度〜西経180度）の場合、正の値を負に変換
  const longitude = rawLongitude > 0 && rawLongitude > 20 && rawLongitude < 180 ? -rawLongitude : rawLongitude;
  
  console.log('📍 PhotoUploadScreenV2 received coordinates:', {
    latitude,
    rawLongitude,
    correctedLongitude: longitude,
    isWesternHemisphere: rawLongitude > 0 && rawLongitude > 20 && rawLongitude < 180,
  });

  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD' | 'EXTREME'>('NORMAL');
  const [hint, setHint] = useState('');
  const [tags, setTags] = useState('');
  
  // V2新規フィールド
  const [sceneType, setSceneType] = useState('nature');
  const [country, setCountry] = useState('XX');
  const [region, setRegion] = useState('XX-XX');
  const [locationName, setLocationName] = useState('取得中...');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'compressing' | 'uploading'>('uploading');
  const [compressionProgress, setCompressionProgress] = useState<{
    current: number;
    max: number;
    phase: string;
  }>({ current: 0, max: 10, phase: '' });
  const [isOptimisticSuccess, setIsOptimisticSuccess] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [displayLat, setDisplayLat] = useState(latitude.toFixed(6));
  const [displayLon, setDisplayLon] = useState(longitude.toFixed(6));
  const [displayAzimuth, setDisplayAzimuth] = useState(azimuth ? azimuth.toFixed(0) : '0');
  const [photoTakenDate, setPhotoTakenDate] = useState(new Date(Number(timestamp)));
  const [showPhotoDatePicker, setShowPhotoDatePicker] = useState(false);

  // 位置情報から地域情報を取得
  useEffect(() => {
    const fetchLocationInfo = async () => {
      try {
        console.log('📍 Fetching location info for coordinates:', {
          latitude,
          longitude,
          latitudeType: typeof latitude,
          longitudeType: typeof longitude,
        });

        // 地域コードを取得
        const regionInfo = await getRegionInfo(latitude, longitude);
        console.log('🌍 Region info obtained:', regionInfo);
        setCountry(regionInfo.country);
        setRegion(regionInfo.region);
        
        // Nominatim API rate limit対策: 1秒待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 地名を取得
        const placeName = await reverseGeocode(latitude, longitude);
        console.log('📍 Place name obtained:', placeName);
        setLocationName(placeName);
      } catch (error) {
        console.error('Failed to fetch location info:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        setLocationName('不明な場所');
      }
    };
    
    fetchLocationInfo();
  }, [latitude, longitude]);


  const onPhotoDateChange = (event: any, selectedDate?: Date) => {
    setShowPhotoDatePicker(false);
    if (selectedDate) {
      setPhotoTakenDate(selectedDate);
    }
  };


  const updateMapPosition = () => {
    const lat = parseFloat(displayLat);
    const lon = parseFloat(displayLon);
    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleUpload = async () => {
    // タイトルフィールドが削除されたので、タイトル検証を削除

    setIsUploading(true);
    setUploadProgress(0);
    setUploadPhase('compressing');
    
    // 圧縮結果を保持する変数
    let compressionResult: { uri: string; compressed: boolean; originalSize: number; compressedSize: number } | null = null;

    try {
      // 画像を1.4MB以下に圧縮（Base64膨張対応：1.4MB × 4/3 ≈ 1.87MB < 2MB）
      compressionResult = await compressImageAsync(photoUri, (current, max, phase) => {
        setCompressionProgress({ current, max, phase });
      });
      
      if (compressionResult.compressed) {
        console.log(`🎯 画像を圧縮しました: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(compressionResult.compressedSize)}`);
      }
      
      // アップロードフェーズに移行
      setUploadPhase('uploading');
      setUploadProgress(0);
      
      // 写真データをバイナリデータに変換（圧縮済みのURIを使用）
      const imageBlob = await imageUriToBlob(compressionResult.uri);
      const imageData = await blobToUint8Array(imageBlob);
      
      console.log('📊 Data size comparison:');
      console.log('  - Binary size:', imageData.length, 'bytes');
      console.log('  - Base64 size (estimated):', Math.ceil(imageData.length * 4/3), 'bytes');
      console.log('  - Savings:', Math.round((1 - (imageData.length / (imageData.length * 4/3))) * 100), '%');

      // デフォルトタイトル
      const defaultTitle = `写真 - ${new Date().toLocaleDateString('ja-JP')}`;

      // 有効な方位角をチェックする関数
      const getValidAzimuth = (inputAzimuth: number | null, displayValue: string): number | null => {
        // 元のazimuthが無効な場合はnull
        if (inputAzimuth === null || inputAzimuth < 0 || inputAzimuth > 360) {
          return null;
        }
        
        // displayValueをパースして有効性をチェック
        const parsedValue = parseFloat(displayValue);
        if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 360) {
          return null;
        }
        
        return parsedValue;
      };

      // V2用の写真データを準備（IDL Optional型用の変換）
      const validAzimuth = getValidAzimuth(azimuth, displayAzimuth);
      
      const photoRequest: CreatePhotoRequest = {
        latitude: parseFloat(displayLat),
        longitude: parseFloat(displayLon),
        azimuth: validAzimuth, // nullの場合は後でIDL変換時に[]に変換される
        title: defaultTitle,
        description,
        difficulty,
        hint,
        country,
        region,
        sceneKind: sceneKindFromString(sceneType),
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        expectedChunks: BigInt(Math.ceil(imageData.length / (256 * 1024))), // 256KB chunks
        totalSize: BigInt(imageData.length),
      };

      // 🎉 楽観的成功表示（重い処理完了時点）
      // 圧縮とデータ準備が完了した時点でユーザーに成功を伝える
      setIsOptimisticSuccess(true);
      setUploadProgress(0.8); // 80%まで進捗を表示

      // Debug logging for identity
      console.log('📸 Upload identity:', identity);
      console.log('📸 Upload principal:', principal?.toString());
      console.log('📸 Upload identity principal:', identity?.getPrincipal()?.toString());
      console.log('📸 Upload identity type:', identity?.constructor?.name);

      // 直接アップロード実行（チャンク処理なし）
      const result = await photoServiceV2Direct.uploadPhotoDirect(
        {
          imageData: imageData, // Uint8Arrayを直接渡す
          metadata: photoRequest,
        },
        identity || undefined
      );
      
      // プログレスバーを100%に設定
      setUploadProgress(1);

      if (result.err) {
        throw new Error(result.err);
      }

      const photoId = result.ok;
      
      // 投稿成功後、実際にICP上に保存されたかを確認
      if (photoId) {
        try {
          const savedPhotoMetadata = await photoServiceV2.getPhotoMetadata(photoId, identity || undefined);
          
          if (savedPhotoMetadata) {
            const compressionInfo = compressionResult && compressionResult.compressed 
              ? `\n🗜️ 圧縮: ${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(compressionResult.compressedSize)}`
              : '';
            
            Alert.alert(
              '投稿成功 ✅',
              `写真がICP上に正常に保存されました\n\n` +
              `📍 位置: ${savedPhotoMetadata.latitude?.toFixed(4) ?? 'N/A'}, ${savedPhotoMetadata.longitude?.toFixed(4) ?? 'N/A'}\n` +
              `🧭 方位角: ${savedPhotoMetadata.azimuth && savedPhotoMetadata.azimuth.length > 0 ? savedPhotoMetadata.azimuth[0].toFixed(0) + '°' : 'なし'}\n` +
              `🌍 地域: ${savedPhotoMetadata.country || 'XX'} / ${savedPhotoMetadata.region || 'XX-XX'}\n` +
              `🏞️ シーン: ${sceneType}\n` +
              `📦 チャンク数: ${savedPhotoMetadata.chunkCount}\n` +
              `💾 サイズ: ${(Number(savedPhotoMetadata.totalSize) / 1024).toFixed(1)} KB` +
              compressionInfo,
              [
                {
                  text: 'OK',
                  onPress: () => {},
                },
              ]
            );
          } else {
            throw new Error('保存されたデータの確認に失敗しました');
          }
        } catch (verifyError) {
          console.error('Verification error:', verifyError);
          Alert.alert(
            '投稿完了',
            '写真は投稿されましたが、保存状況の確認に失敗しました。',
            [
              {
                text: 'OK',
                onPress: () => {},
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      Alert.alert('エラー', '写真のアップロードに失敗しました');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setIsOptimisticSuccess(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#f5f5f5" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>写真をアップロード</Text>
            <View style={styles.backButton} />
          </View>

          {/* 写真プレビュー */}
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <View style={styles.photoInfo}>
              <Text style={styles.photoInfoText}>📍 {locationName}</Text>
              <Text style={styles.photoInfoText}>🌍 {country} / {region}</Text>
              <Text style={styles.photoInfoText}>
                🧭 {latitude.toFixed(6)}°{latitude >= 0 ? 'N' : 'S'}, {Math.abs(longitude).toFixed(6)}°{longitude >= 0 ? 'E' : 'W'}
              </Text>
              <TouchableOpacity onPress={() => setShowPhotoDatePicker(true)}>
                <Text style={styles.photoInfoText}>
                  📅 {photoTakenDate.toLocaleString('ja-JP')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 位置情報 */}
          <TouchableOpacity onPress={() => setShowMapModal(true)} style={styles.locationSection}>
            <Text style={styles.sectionTitle}>📍 位置情報</Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>
                緯度: {displayLat}, 経度: {displayLon}
              </Text>
              <Text style={styles.locationText}>
                方位角: {azimuth !== null ? `${displayAzimuth}°` : 'なし'}
              </Text>
            </View>
            <Text style={styles.editHint}>タップして編集</Text>
          </TouchableOpacity>


          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>説明</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="この写真について説明してください"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* シーンタイプ選択（V2新機能） */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>シーンタイプ</Text>
            <View style={styles.sceneTypeButtons}>
              {SCENE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.sceneTypeButton,
                    sceneType === type.value && styles.sceneTypeButtonActive,
                  ]}
                  onPress={() => setSceneType(type.value)}
                >
                  <Text
                    style={[
                      styles.sceneTypeButtonText,
                      sceneType === type.value && styles.sceneTypeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 難易度選択 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>難易度</Text>
            <View style={styles.difficultyButtons}>
              {(['EASY', 'NORMAL', 'HARD', 'EXTREME'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.difficultyButton,
                    difficulty === level && styles.difficultyButtonActive,
                  ]}
                  onPress={() => setDifficulty(level)}
                >
                  <Text
                    style={[
                      styles.difficultyButtonText,
                      difficulty === level && styles.difficultyButtonTextActive,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ヒント */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>ヒント</Text>
            <TextInput
              style={styles.input}
              value={hint}
              onChangeText={setHint}
              placeholder="例: 日本一高い山から撮影"
              placeholderTextColor="#666"
            />
          </View>

          {/* タグ */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>タグ（カンマ区切り）</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="例: 山, 朝日, 風景"
              placeholderTextColor="#666"
            />
          </View>


          {/* アップロードボタン */}
          <TouchableOpacity
            style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadingContainer}>
                {isOptimisticSuccess ? (
                  <>
                    <Text style={styles.successIcon}>✅</Text>
                    <Text style={styles.uploadButtonText}>
                      投稿完了！バックグラウンドで同期中...
                    </Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.uploadButtonText}>
                      {uploadPhase === 'compressing' 
                        ? `${compressionProgress.phase} (${compressionProgress.current}/${compressionProgress.max})` 
                        : `アップロード中... ${Math.round(uploadProgress * 100)}%`}
                    </Text>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.uploadButtonText}>
                投稿する
              </Text>
            )}
          </TouchableOpacity>

          {/* プログレスバー */}
          {isUploading && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { 
                width: uploadPhase === 'compressing' 
                  ? `${(compressionProgress.current / compressionProgress.max) * 100}%`
                  : `${uploadProgress * 100}%` 
              }]} />
            </View>
          )}

          {/* 圧縮中のヒントパネル */}
          {isUploading && uploadPhase === 'compressing' && !isOptimisticSuccess && (
            <View style={styles.compressionHintPanel}>
              <Text style={styles.compressionHintTitle}>💡 圧縮処理中...</Text>
              <Text style={styles.compressionHintText}>
                {compressionProgress.current === 0 
                  ? "画像のサイズを確認しています"
                  : compressionProgress.current <= 3
                  ? "画質を調整して最適なバランスを探しています"
                  : compressionProgress.current <= 6
                  ? "解像度を調整してファイルサイズを削減しています"
                  : "最終的な微調整を行っています"
                }
              </Text>
              <Text style={styles.compressionHintSubtext}>
                この間も、説明文やタグなどの情報を編集できます
              </Text>
            </View>
          )}

          {/* 楽観的成功パネル */}
          {isOptimisticSuccess && (
            <View style={styles.optimisticSuccessPanel}>
              <Text style={styles.optimisticSuccessTitle}>🎉 投稿が完了しました！</Text>
              <Text style={styles.optimisticSuccessText}>
                写真の処理が完了し、ゲームで使用できるようになりました。
              </Text>
              <Text style={styles.optimisticSuccessSubtext}>
                バックグラウンドで最終的な同期処理を行っています
              </Text>
              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.homeButtonText}>ホームに戻る</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 位置情報編集モーダル */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={styles.modalCloseButton}>閉じる</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>位置情報を編集</Text>
            <TouchableOpacity onPress={updateMapPosition}>
              <Text style={styles.modalUpdateButton}>更新</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalInputContainer}>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalInputLabel}>緯度:</Text>
              <TextInput
                style={styles.modalInput}
                value={displayLat}
                onChangeText={setDisplayLat}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalInputLabel}>経度:</Text>
              <TextInput
                style={styles.modalInput}
                value={displayLon}
                onChangeText={setDisplayLon}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalInputLabel}>方位角:</Text>
              <TextInput
                style={styles.modalInput}
                value={displayAzimuth}
                onChangeText={setDisplayAzimuth}
                keyboardType="numeric"
                placeholder="0-360度 (任意)"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <MapView
            ref={mapRef}
            style={styles.modalMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: parseFloat(displayLat),
              longitude: parseFloat(displayLon),
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onRegionChangeComplete={(region) => {
              setDisplayLat(region.latitude.toFixed(6));
              setDisplayLon(region.longitude.toFixed(6));
            }}
          >
            <Marker
              coordinate={{
                latitude: parseFloat(displayLat),
                longitude: parseFloat(displayLon),
              }}
              title="撮影位置"
            />
          </MapView>
        </SafeAreaView>
      </Modal>

      {/* 日付選択モーダル */}
      {showPhotoDatePicker && DateTimePicker && (
        <DateTimePicker
          value={photoTakenDate}
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={onPhotoDateChange}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 80,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  photoContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  photoInfo: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  photoInfoText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  locationSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationInfo: {
    marginTop: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  editHint: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
  },
  inputSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sceneTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sceneTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  sceneTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sceneTypeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sceneTypeButtonTextActive: {
    color: '#fff',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  difficultyButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  difficultyButtonTextActive: {
    color: '#fff',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalUpdateButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalInputContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalInputLabel: {
    width: 80,
    fontSize: 14,
    color: '#666',
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    color: '#333',
  },
  modalMap: {
    flex: 1,
  },
  compressionHintPanel: {
    backgroundColor: '#e3f2fd',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  compressionHintTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  compressionHintText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 8,
    lineHeight: 20,
  },
  compressionHintSubtext: {
    fontSize: 12,
    color: '#64b5f6',
    fontStyle: 'italic',
  },
  successIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  optimisticSuccessPanel: {
    backgroundColor: '#e8f5e8',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  optimisticSuccessTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
  },
  optimisticSuccessText: {
    fontSize: 14,
    color: '#388e3c',
    marginBottom: 8,
    lineHeight: 20,
  },
  optimisticSuccessSubtext: {
    fontSize: 12,
    color: '#66bb6a',
    fontStyle: 'italic',
  },
  homeButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});