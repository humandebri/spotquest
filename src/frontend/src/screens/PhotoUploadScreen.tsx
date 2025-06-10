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
import photoService, { PhotoUploadData, imageUriToBase64, reverseGeocode } from '../services/photo';

type PhotoUploadScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoUpload'>;
type PhotoUploadScreenRouteProp = RouteProp<RootStackParamList, 'PhotoUpload'>;

// DateTimePickerのインポートを修正
let DateTimePicker: any;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
  DateTimePicker = null;
}

export default function PhotoUploadScreen() {
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
  const [isUploading, setIsUploading] = useState(false);
  const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // 逆ジオコーディング用の状態
  const [address, setAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');

  // 位置情報の表示用フォーマット
  const [displayLat, setDisplayLat] = useState(latitude.toFixed(6));
  const [displayLon, setDisplayLon] = useState(longitude.toFixed(6));
  const [displayAzimuth, setDisplayAzimuth] = useState(azimuth.toString());
  
  // 撮影日時の状態
  const [photoTakenDate, setPhotoTakenDate] = useState(new Date(timestamp));
  const [showPhotoDatePicker, setShowPhotoDatePicker] = useState(false);

  // 地図用の状態
  const [mapRegion, setMapRegion] = useState({
    latitude: latitude,
    longitude: longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    // 初期スケジュール時間を設定
    const now = new Date();
    now.setMinutes(now.getMinutes() + uploadDelay);
    setScheduledTime(now);
  }, [uploadDelay]);

  // 方位角ラインの終点を計算
  const calculateAzimuthEndpoint = (lat: number, lon: number, azimuth: number, distance: number = 0.005) => {
    const azimuthRad = (azimuth * Math.PI) / 180;
    const latEnd = lat + distance * Math.cos(azimuthRad);
    const lonEnd = lon + distance * Math.sin(azimuthRad) / Math.cos((lat * Math.PI) / 180);
    return { latitude: latEnd, longitude: lonEnd };
  };

  // 位置情報が変更されたら地図を更新
  useEffect(() => {
    const lat = parseFloat(displayLat);
    const lon = parseFloat(displayLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setMapRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [displayLat, displayLon]);

  // 逆ジオコーディング関数
  const fetchAddress = async () => {
    const lat = parseFloat(displayLat);
    const lon = parseFloat(displayLon);
    
    if (isNaN(lat) || isNaN(lon)) {
      setAddressError('有効な座標を入力してください');
      return;
    }

    setIsLoadingAddress(true);
    setAddressError('');

    try {
      const addressResult = await reverseGeocode(lat, lon);
      setAddress(addressResult);
    } catch (error) {
      console.error('Address fetch error:', error);
      setAddressError('住所の取得に失敗しました');
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // 初回読み込み時に住所を取得
  useEffect(() => {
    fetchAddress();
  }, []);

  const handleUpload = async () => {
    if (!principal) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setIsUploading(true);

    try {
      // 画像をBase64に変換
      const base64Data = await imageUriToBase64(photoUri);

      // デフォルトタイトルを生成
      const defaultTitle = `Photo ${new Date(photoTakenDate.getTime()).toLocaleDateString('ja-JP')}`;

      // 写真データの準備
      const photoData: PhotoUploadData = {
        imageData: base64Data,
        latitude: parseFloat(displayLat),
        longitude: parseFloat(displayLon),
        azimuth: parseFloat(displayAzimuth),
        title: title.trim() || defaultTitle,
        description,
        difficulty,
        hint,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        timestamp: BigInt(photoTakenDate.getTime()),
        scheduledPublishTime: uploadDelay > 0 ? BigInt(scheduledTime.getTime()) : null,
      };

      // Canisterに送信
      const result = await photoService.uploadPhoto(photoData, identity);

      if (result.err) {
        throw new Error(result.err);
      }

      const photoId = result.ok;
      
      // 投稿成功後、実際にICP上に保存されたかを確認
      if (uploadDelay === 0 && photoId) {
        // 即時投稿の場合、保存状況を確認
        try {
          const savedPhotoMetadata = await photoService.getPhotoMetadata(photoId, identity);
          
          if (savedPhotoMetadata) {
            Alert.alert(
              '投稿成功 ✅',
              `写真がICP上に正常に保存されました\n\n` +
              `📍 位置: ${savedPhotoMetadata.lat.toFixed(4)}, ${savedPhotoMetadata.lon.toFixed(4)}\n` +
              `🧭 方位角: ${savedPhotoMetadata.azim.toFixed(0)}°\n` +
              `📊 品質スコア: ${(savedPhotoMetadata.quality * 100).toFixed(1)}%\n` +
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
      } else {
        // 予約投稿の場合
        Alert.alert(
          '予約投稿成功 📅',
          `写真が${uploadDelay}分後に自動投稿されます\n\n` +
          `予約投稿ID: ${photoId}\n` +
          `公開予定時刻: ${scheduledTime.toLocaleString('ja-JP')}`,
          [
            {
              text: '予約投稿を見る',
              onPress: () => navigation.navigate('ScheduledPhotos'),
            },
            {
              text: 'ホームに戻る',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('エラー', '写真のアップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* プレビュー画像 */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          </View>

          {/* 基本情報入力 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>基本情報</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>説明</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="写真の説明を入力（2行まで）"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={2}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>難易度</Text>
              <TouchableOpacity
                style={styles.difficultySelector}
                onPress={() => setShowDifficultyPicker(true)}
              >
                <Text style={styles.difficultySelectorText}>
                  {difficulty === 'EASY' && 'EASY - 簡単'}
                  {difficulty === 'NORMAL' && 'NORMAL - 普通'}
                  {difficulty === 'HARD' && 'HARD - 難しい'}
                  {difficulty === 'EXTREME' && 'EXTREME - 極難'}
                </Text>
                <Text style={styles.difficultySelectorIcon}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ヒント</Text>
              <TextInput
                style={styles.input}
                value={hint}
                onChangeText={setHint}
                placeholder="プレイヤーへのヒント"
                placeholderTextColor="#64748b"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>タグ（カンマ区切り）</Text>
              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="例: 東京,観光地,桜"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          {/* 位置情報の確認・編集 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>位置情報</Text>

            <View style={styles.locationGrid}>
              <View style={[styles.inputGroup, styles.gridItem]}>
                <Text style={styles.label}>緯度</Text>
                <TextInput
                  style={styles.input}
                  value={displayLat}
                  onChangeText={setDisplayLat}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.inputGroup, styles.gridItem]}>
                <Text style={styles.label}>経度</Text>
                <TextInput
                  style={styles.input}
                  value={displayLon}
                  onChangeText={setDisplayLon}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>方位角（度）</Text>
              <TextInput
                style={styles.input}
                value={displayAzimuth}
                onChangeText={setDisplayAzimuth}
                keyboardType="numeric"
                placeholder="0-360"
              />
            </View>

            {/* 撮影日時 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>撮影日時</Text>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowPhotoDatePicker(true)}
              >
                <Text style={styles.dateSelectorText}>
                  {photoTakenDate.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.dateSelectorIcon}>📅</Text>
              </TouchableOpacity>
            </View>

            {/* 地図プレビュー */}
            <TouchableOpacity
              style={styles.mapPreviewContainer}
              onPress={() => setShowMapModal(true)}
            >
              <MapView
                style={styles.mapPreview}
                region={mapRegion}
                provider={PROVIDER_GOOGLE}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: parseFloat(displayLat) || latitude,
                    longitude: parseFloat(displayLon) || longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.mapMarker}>
                    <Text style={styles.mapMarkerText}>📍</Text>
                  </View>
                </Marker>

                {/* 方位角ライン */}
                <Polyline
                  coordinates={[
                    {
                      latitude: parseFloat(displayLat) || latitude,
                      longitude: parseFloat(displayLon) || longitude,
                    },
                    calculateAzimuthEndpoint(
                      parseFloat(displayLat) || latitude,
                      parseFloat(displayLon) || longitude,
                      parseFloat(displayAzimuth) || azimuth,
                      0.003
                    ),
                  ]}
                  strokeColor="#00ff88"
                  strokeWidth={4}
                  lineDashPattern={[10, 5]}
                />
                
                {/* 方位角方向の矢印マーカー */}
                <Marker
                  coordinate={calculateAzimuthEndpoint(
                    parseFloat(displayLat) || latitude,
                    parseFloat(displayLon) || longitude,
                    parseFloat(displayAzimuth) || azimuth,
                    0.003
                  )}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.directionArrow, { 
                    transform: [{ rotate: `${parseFloat(displayAzimuth) || azimuth}deg` }] 
                  }]}>
                    <Text style={styles.directionArrowText}>▲</Text>
                  </View>
                </Marker>
              </MapView>
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayText}>タップして拡大</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 住所情報 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>住所</Text>
            
            <View style={styles.addressContainer}>
              {isLoadingAddress ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3282b8" />
                  <Text style={styles.loadingText}>住所を取得中...</Text>
                </View>
              ) : addressError ? (
                <Text style={styles.errorText}>{addressError}</Text>
              ) : (
                <Text style={styles.addressText}>
                  {address || '住所が取得できませんでした'}
                </Text>
              )}
            </View>

            <Text style={styles.addressNote}>
              ※ この住所は位置情報から自動取得されます
            </Text>
          </View>

          {/* 投稿タイミング */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>投稿タイミング</Text>

            <View style={styles.timingOptions}>
              <TouchableOpacity
                style={[styles.timingButton, uploadDelay === 0 && styles.timingButtonActive]}
                onPress={() => setUploadDelay(0)}
              >
                <Text style={[styles.timingButtonText, uploadDelay === 0 && styles.timingButtonTextActive]}>
                  今すぐ投稿
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timingButton, uploadDelay === 5 && styles.timingButtonActive]}
                onPress={() => setUploadDelay(5)}
              >
                <Text style={[styles.timingButtonText, uploadDelay === 5 && styles.timingButtonTextActive]}>
                  5分後
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timingButton, uploadDelay === 30 && styles.timingButtonActive]}
                onPress={() => setUploadDelay(30)}
              >
                <Text style={[styles.timingButtonText, uploadDelay === 30 && styles.timingButtonTextActive]}>
                  30分後
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timingButton, uploadDelay === -1 && styles.timingButtonActive]}
                onPress={() => {
                  setUploadDelay(-1);
                  setShowDatePicker(true);
                }}
              >
                <Text style={[styles.timingButtonText, uploadDelay === -1 && styles.timingButtonTextActive]}>
                  時間指定
                </Text>
              </TouchableOpacity>
            </View>

            {uploadDelay !== 0 && (
              <View style={styles.scheduledTimeContainer}>
                <Text style={styles.scheduledTimeText}>
                  投稿予定時刻: {scheduledTime.toLocaleString('ja-JP')}
                </Text>
              </View>
            )}

            {showDatePicker && DateTimePicker && (
              <DateTimePicker
                value={scheduledTime}
                mode="datetime"
                is24Hour={true}
                display="default"
                onChange={(event: any, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setScheduledTime(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* 投稿ボタン */}
          <TouchableOpacity
            style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.uploadButtonText}>
                {uploadDelay > 0 ? '予約投稿する' : '投稿する'}
              </Text>
            )}
          </TouchableOpacity>

          {/* キャンセルボタン */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isUploading}
          >
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 難易度選択モーダル */}
      <Modal
        visible={showDifficultyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDifficultyPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDifficultyPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>難易度を選択</Text>
            {(['EASY', 'NORMAL', 'HARD', 'EXTREME'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={styles.modalOption}
                onPress={() => {
                  setDifficulty(level);
                  setShowDifficultyPicker(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  difficulty === level && styles.modalOptionTextActive
                ]}>
                  {level === 'EASY' && 'EASY - 簡単'}
                  {level === 'NORMAL' && 'NORMAL - 普通'}
                  {level === 'HARD' && 'HARD - 難しい'}
                  {level === 'EXTREME' && 'EXTREME - 極難'}
                </Text>
                {difficulty === level && (
                  <Text style={styles.modalOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 地図モーダル */}
      <Modal
        visible={showMapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModalContainer} edges={['top', 'left', 'right']}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>撮影位置の確認</Text>
            <TouchableOpacity
              style={styles.mapModalClose}
              onPress={() => setShowMapModal(false)}
            >
              <Text style={styles.mapModalCloseText}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <MapView
            ref={mapRef}
            style={styles.mapModalMap}
            region={mapRegion}
            provider={PROVIDER_GOOGLE}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            <Marker
              coordinate={{
                latitude: parseFloat(displayLat) || latitude,
                longitude: parseFloat(displayLon) || longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.mapMarkerLarge}>
                <Text style={styles.mapMarkerTextLarge}>📍</Text>
              </View>
            </Marker>

            {/* 方位角ライン */}
            <Polyline
              coordinates={[
                {
                  latitude: parseFloat(displayLat) || latitude,
                  longitude: parseFloat(displayLon) || longitude,
                },
                calculateAzimuthEndpoint(
                  parseFloat(displayLat) || latitude,
                  parseFloat(displayLon) || longitude,
                  parseFloat(displayAzimuth) || azimuth,
                  0.015
                ),
              ]}
              strokeColor="#00ff88"
              strokeWidth={6}
              lineDashPattern={[15, 8]}
            />
            
            {/* 方位角方向の矢印マーカー */}
            <Marker
              coordinate={calculateAzimuthEndpoint(
                parseFloat(displayLat) || latitude,
                parseFloat(displayLon) || longitude,
                parseFloat(displayAzimuth) || azimuth,
                0.015
              )}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.directionArrowLarge, { 
                transform: [{ rotate: `${parseFloat(displayAzimuth) || azimuth}deg` }] 
              }]}>
                <Text style={styles.directionArrowTextLarge}>▲</Text>
              </View>
            </Marker>
            
            {/* 視野角を示す扇形のライン */}
            <Polyline
              coordinates={[
                {
                  latitude: parseFloat(displayLat) || latitude,
                  longitude: parseFloat(displayLon) || longitude,
                },
                calculateAzimuthEndpoint(
                  parseFloat(displayLat) || latitude,
                  parseFloat(displayLon) || longitude,
                  (parseFloat(displayAzimuth) || azimuth) - 30,
                  0.01
                ),
              ]}
              strokeColor="rgba(0, 255, 136, 0.4)"
              strokeWidth={2}
            />
            <Polyline
              coordinates={[
                {
                  latitude: parseFloat(displayLat) || latitude,
                  longitude: parseFloat(displayLon) || longitude,
                },
                calculateAzimuthEndpoint(
                  parseFloat(displayLat) || latitude,
                  parseFloat(displayLon) || longitude,
                  (parseFloat(displayAzimuth) || azimuth) + 30,
                  0.01
                ),
              ]}
              strokeColor="rgba(0, 255, 136, 0.4)"
              strokeWidth={2}
            />

            {/* 視野円 */}
            <Circle
              center={{
                latitude: parseFloat(displayLat) || latitude,
                longitude: parseFloat(displayLon) || longitude,
              }}
              radius={200}
              fillColor="rgba(50, 130, 184, 0.1)"
              strokeColor="rgba(50, 130, 184, 0.3)"
              strokeWidth={2}
            />
          </MapView>
          <View style={styles.mapModalInfo}>
            <Text style={styles.mapModalInfoText}>
              📍 {displayLat}, {displayLon}
            </Text>
            <Text style={styles.mapModalInfoText}>
              🧭 方位角: {displayAzimuth}°
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 撮影日時ピッカー */}
      {showPhotoDatePicker && DateTimePicker && (
        <DateTimePicker
          value={photoTakenDate}
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={(event: any, selectedDate?: Date) => {
            setShowPhotoDatePicker(false);
            if (selectedDate) {
              setPhotoTakenDate(selectedDate);
            }
          }}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: 250,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 4,
  },
  formSection: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#3282b8',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 16,
    padding: 12,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#ffffff',
    height: 50,
  },
  locationGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
  },
  timingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timingButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  timingButtonActive: {
    backgroundColor: '#3282b8',
    borderColor: '#3282b8',
  },
  timingButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  timingButtonTextActive: {
    color: '#ffffff',
  },
  scheduledTimeContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  scheduledTimeText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#3282b8',
    margin: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  difficultySelector: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultySelectorText: {
    color: '#ffffff',
    fontSize: 16,
  },
  difficultySelectorIcon: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dateSelector: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateSelectorText: {
    color: '#ffffff',
    fontSize: 16,
  },
  dateSelectorIcon: {
    fontSize: 16,
  },
  mapPreviewContainer: {
    marginTop: 16,
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPreview: {
    flex: 1,
  },
  mapMarker: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarkerText: {
    fontSize: 24,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  mapOverlayText: {
    color: '#ffffff',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  modalOptionTextActive: {
    color: '#3282b8',
    fontWeight: 'bold',
  },
  modalOptionCheck: {
    color: '#3282b8',
    fontSize: 20,
    fontWeight: 'bold',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#0f1117',
    paddingTop: 30,
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  mapModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mapModalCloseText: {
    color: '#3282b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapModalMap: {
    flex: 1,
  },
  mapMarkerLarge: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarkerTextLarge: {
    fontSize: 32,
  },
  mapModalInfo: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  mapModalInfoText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  // 住所関連のスタイル
  addressContainer: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  addressText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#3282b8',
    borderRadius: 6,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 18,
  },
  addressNote: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // 方角表示のスタイル
  directionArrow: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.9)',
    borderRadius: 10,
    shadowColor: '#00ff88',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 5,
  },
  directionArrowText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  directionArrowLarge: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.95)',
    borderRadius: 15,
    shadowColor: '#00ff88',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  directionArrowTextLarge: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});