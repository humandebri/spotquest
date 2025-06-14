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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../hooks/useAuth';
import { 
  photoServiceV2, 
  imageUriToBase64, 
  getRegionInfo,
  sceneKindFromString,
  CreatePhotoRequest,
  SceneKind
} from '../services/photoV2';
import { reverseGeocode } from '../services/photo'; // 一時的に旧サービスから流用

type PhotoUploadScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoUpload'>;
type PhotoUploadScreenRouteProp = RouteProp<RootStackParamList, 'PhotoUpload'>;

// DateTimePickerのインポートを修正
let DateTimePicker: any;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
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

  const { photoUri, latitude, longitude, azimuth, timestamp } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD' | 'EXTREME'>('NORMAL');
  const [hint, setHint] = useState('');
  const [tags, setTags] = useState('');
  const [uploadDelay, setUploadDelay] = useState(0); // 分単位
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // V2新規フィールド
  const [sceneType, setSceneType] = useState('other');
  const [country, setCountry] = useState('XX');
  const [region, setRegion] = useState('XX-XX');
  const [locationName, setLocationName] = useState('取得中...');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMapModal, setShowMapModal] = useState(false);
  const [displayLat, setDisplayLat] = useState(latitude.toFixed(6));
  const [displayLon, setDisplayLon] = useState(longitude.toFixed(6));
  const [displayAzimuth, setDisplayAzimuth] = useState(azimuth.toFixed(0));
  const [photoTakenDate, setPhotoTakenDate] = useState(new Date(Number(timestamp)));
  const [showPhotoDatePicker, setShowPhotoDatePicker] = useState(false);

  // 位置情報から地域情報を取得
  useEffect(() => {
    const fetchLocationInfo = async () => {
      try {
        // 地域コードを取得
        const regionInfo = await getRegionInfo(latitude, longitude);
        setCountry(regionInfo.country);
        setRegion(regionInfo.region);
        
        // 地名を取得
        const placeName = await reverseGeocode(latitude, longitude);
        setLocationName(placeName);
      } catch (error) {
        console.error('Failed to fetch location info:', error);
        setLocationName('不明な場所');
      }
    };
    
    fetchLocationInfo();
  }, [latitude, longitude]);

  useEffect(() => {
    if (uploadDelay > 0) {
      const delay = new Date();
      delay.setMinutes(delay.getMinutes() + uploadDelay);
      setScheduledTime(delay);
    }
  }, [uploadDelay]);

  const onPhotoDateChange = (event: any, selectedDate?: Date) => {
    setShowPhotoDatePicker(false);
    if (selectedDate) {
      setPhotoTakenDate(selectedDate);
    }
  };

  const onScheduledTimeChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setScheduledTime(selectedDate);
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
    if (!title.trim() && uploadDelay === 0) {
      Alert.alert('エラー', 'タイトルを入力してください');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 写真データをBase64に変換
      const base64Data = await imageUriToBase64(photoUri);

      // デフォルトタイトル（予約投稿の場合）
      const defaultTitle = uploadDelay > 0 
        ? `予約投稿 - ${new Date().toLocaleDateString('ja-JP')}`
        : '無題の写真';

      // V2用の写真データを準備
      const photoRequest: CreatePhotoRequest = {
        latitude: parseFloat(displayLat),
        longitude: parseFloat(displayLon),
        azimuth: azimuth ? parseFloat(displayAzimuth) : null,
        title: title.trim() || defaultTitle,
        description,
        difficulty,
        hint,
        country,
        region,
        sceneKind: sceneKindFromString(sceneType),
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        expectedChunks: BigInt(Math.ceil(base64Data.length / (256 * 1024))), // 256KB chunks
        totalSize: BigInt(base64Data.length),
      };

      // 予約投稿の処理（現在は未実装）
      if (uploadDelay > 0) {
        Alert.alert('準備中', '予約投稿機能は現在V2 APIでは準備中です');
        setIsUploading(false);
        return;
      }

      // 3段階アップロード実行
      const result = await photoServiceV2.uploadPhotoWithChunks(
        {
          imageData: base64Data,
          metadata: photoRequest,
        },
        identity,
        (progress) => setUploadProgress(progress)
      );

      if (result.err) {
        throw new Error(result.err);
      }

      const photoId = result.ok;
      
      // 投稿成功後、実際にICP上に保存されたかを確認
      if (photoId) {
        try {
          const savedPhotoMetadata = await photoServiceV2.getPhotoMetadata(photoId, identity);
          
          if (savedPhotoMetadata) {
            Alert.alert(
              '投稿成功 ✅',
              `写真がICP上に正常に保存されました\n\n` +
              `📍 位置: ${savedPhotoMetadata.latitude?.toFixed(4) ?? 'N/A'}, ${savedPhotoMetadata.longitude?.toFixed(4) ?? 'N/A'}\n` +
              `🧭 方位角: ${savedPhotoMetadata.azimuth ? savedPhotoMetadata.azimuth.toFixed(0) + '°' : 'なし'}\n` +
              `🌍 地域: ${savedPhotoMetadata.country || 'XX'} / ${savedPhotoMetadata.region || 'XX-XX'}\n` +
              `🏞️ シーン: ${sceneType}\n` +
              `📊 品質スコア: ${(savedPhotoMetadata.qualityScore * 100).toFixed(1)}%\n` +
              `📦 チャンク数: ${savedPhotoMetadata.chunkCount}\n` +
              `💾 サイズ: ${(Number(savedPhotoMetadata.totalSize) / 1024).toFixed(1)} KB`,
              [
                {
                  text: 'プロフィールで確認',
                  onPress: () => navigation.navigate('Profile'),
                },
                {
                  text: 'ホームに戻る',
                  onPress: () => navigation.navigate('Home'),
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
            '写真は投稿されましたが、保存状況の確認に失敗しました。\nプロフィール画面で確認してください。',
            [
              {
                text: 'プロフィールで確認',
                onPress: () => navigation.navigate('Profile'),
              },
              {
                text: 'ホームに戻る',
                onPress: () => navigation.navigate('Home'),
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
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
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
                方位角: {displayAzimuth}°
              </Text>
            </View>
            <Text style={styles.editHint}>タップして編集</Text>
          </TouchableOpacity>

          {/* 基本情報入力 */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>タイトル *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="例: 富士山から見た朝日"
              placeholderTextColor="#666"
            />
          </View>

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

          {/* 投稿タイミング */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>投稿タイミング</Text>
            <View style={styles.uploadDelayButtons}>
              <TouchableOpacity
                style={[
                  styles.uploadDelayButton,
                  uploadDelay === 0 && styles.uploadDelayButtonActive,
                ]}
                onPress={() => setUploadDelay(0)}
              >
                <Text
                  style={[
                    styles.uploadDelayButtonText,
                    uploadDelay === 0 && styles.uploadDelayButtonTextActive,
                  ]}
                >
                  今すぐ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.uploadDelayButton,
                  uploadDelay === 30 && styles.uploadDelayButtonActive,
                ]}
                onPress={() => setUploadDelay(30)}
              >
                <Text
                  style={[
                    styles.uploadDelayButtonText,
                    uploadDelay === 30 && styles.uploadDelayButtonTextActive,
                  ]}
                >
                  30分後
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.uploadDelayButton,
                  uploadDelay === 60 && styles.uploadDelayButtonActive,
                ]}
                onPress={() => setUploadDelay(60)}
              >
                <Text
                  style={[
                    styles.uploadDelayButtonText,
                    uploadDelay === 60 && styles.uploadDelayButtonTextActive,
                  ]}
                >
                  1時間後
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* アップロードボタン */}
          <TouchableOpacity
            style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.uploadButtonText}>
                  アップロード中... {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
            ) : (
              <Text style={styles.uploadButtonText}>
                {uploadDelay > 0 ? '予約投稿する' : '投稿する'}
              </Text>
            )}
          </TouchableOpacity>

          {/* プログレスバー */}
          {isUploading && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]} />
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
        <SafeAreaView style={styles.modalContainer}>
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

      {showDatePicker && DateTimePicker && (
        <DateTimePicker
          value={scheduledTime}
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={onScheduledTimeChange}
          minimumDate={new Date()}
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
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  difficultyButtonTextActive: {
    color: '#fff',
  },
  uploadDelayButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadDelayButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  uploadDelayButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  uploadDelayButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  uploadDelayButtonTextActive: {
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
});