import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type PhotoLibraryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoLibrary'>;

interface PhotoLocation {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

interface SelectedPhoto {
  uri: string;
  width: number;
  height: number;
  location?: PhotoLocation;
  timestamp?: number;
}

export default function PhotoLibraryScreen() {
  const navigation = useNavigation<PhotoLibraryScreenNavigationProp>();
  const mapRef = useRef<MapView>(null);

  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [manualLocation, setManualLocation] = useState<PhotoLocation | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // 権限の確認とリクエスト
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // MediaLibraryの権限をリクエスト
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'メディアライブラリへのアクセス権限が必要です。');
    }
  };

  // 写真を選択
  const pickImage = async () => {
    setIsLoading(true);
    try {
      // ImagePickerで写真を選択
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: true, // EXIF情報を含める
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) {
        setIsLoading(false);
        return;
      }

      const pickedPhoto = result.assets[0];
      
      // MediaLibraryからより詳細な位置情報を取得
      let photoLocation: PhotoLocation | undefined = undefined;
      
      try {
        // まず、選択された写真のURIからMediaLibraryのアセットを検索
        const assets = await MediaLibrary.getAssetsAsync({
          first: 100,
          mediaType: 'photo',
          sortBy: [MediaLibrary.SortBy.creationTime],
        });

        // URIが一致するアセットを探す
        const matchingAsset = assets.assets.find(asset => 
          asset.uri === pickedPhoto.uri || 
          asset.uri.includes(pickedPhoto.uri.split('/').pop() || '') ||
          pickedPhoto.uri.includes(asset.uri.split('/').pop() || '')
        );

        if (matchingAsset?.location) {
          photoLocation = {
            latitude: matchingAsset.location.latitude,
            longitude: matchingAsset.location.longitude,
            timestamp: matchingAsset.creationTime || Date.now(),
          };
          console.log('📍 位置情報を取得:', photoLocation);
        } else {
          console.log('📍 写真に位置情報が含まれていません');
        }
      } catch (error) {
        console.error('MediaLibrary location extraction error:', error);
        
        // フォールバック: ImagePickerのEXIF情報をチェック
        if (pickedPhoto.exif?.GPSLatitude && pickedPhoto.exif?.GPSLongitude) {
          photoLocation = {
            latitude: pickedPhoto.exif.GPSLatitude,
            longitude: pickedPhoto.exif.GPSLongitude,
            timestamp: Date.now(),
          };
          console.log('📍 EXIF位置情報を取得:', photoLocation);
        }
      }

      const photoData: SelectedPhoto = {
        uri: pickedPhoto.uri,
        width: pickedPhoto.width,
        height: pickedPhoto.height,
        location: photoLocation,
        timestamp: Date.now(),
      };

      setSelectedPhoto(photoData);

      // 位置情報がない場合は手動選択を促す
      if (!photoLocation) {
        Alert.alert(
          '位置情報なし',
          'この写真には位置情報が含まれていません。地図で撮影場所を選択してください。',
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '位置を選択', onPress: openLocationPicker },
          ]
        );
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('エラー', '写真の選択に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 位置選択モーダルを開く
  const openLocationPicker = async () => {
    // 現在地を取得して初期表示位置とする
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMapRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.log('Current location not available, using default');
    }
    
    setShowLocationPicker(true);
  };

  // 地図上の位置を確定
  const confirmLocation = () => {
    if (manualLocation && selectedPhoto) {
      const updatedPhoto: SelectedPhoto = {
        ...selectedPhoto,
        location: manualLocation,
      };
      setSelectedPhoto(updatedPhoto);
      setShowLocationPicker(false);
    }
  };

  // 次の画面に進む
  const proceedToUpload = () => {
    if (!selectedPhoto) return;

    const location = selectedPhoto.location;
    if (!location) {
      Alert.alert('位置情報が必要です', '撮影場所を選択してください。');
      return;
    }

    // PhotoUploadScreenに遷移
    navigation.navigate('PhotoUpload', {
      photoUri: selectedPhoto.uri,
      latitude: location.latitude,
      longitude: location.longitude,
      azimuth: null, // ギャラリー写真は方位角なし
      timestamp: selectedPhoto.timestamp || Date.now(),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <LinearGradient colors={['#1a1a2e', '#0f1117']} style={styles.gradient}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ギャラリーから選択</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* 選択された写真の表示 */}
          {selectedPhoto ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.selectedPhoto} />
              
              {/* 位置情報ステータス */}
              <View style={styles.locationStatus}>
                {selectedPhoto.location ? (
                  <View style={styles.locationFound}>
                    <Ionicons name="location" size={20} color="#4CAF50" />
                    <Text style={styles.locationText}>
                      📍 {selectedPhoto.location.latitude.toFixed(6)}, {selectedPhoto.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.locationMissing}>
                    <Ionicons name="location-outline" size={20} color="#FFC107" />
                    <Text style={styles.locationText}>位置情報なし</Text>
                  </View>
                )}
              </View>

              {/* アクションボタン */}
              <View style={styles.actionButtons}>
                {!selectedPhoto.location && (
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={openLocationPicker}
                  >
                    <Ionicons name="map" size={20} color="#fff" />
                    <Text style={styles.buttonText}>位置を選択</Text>
                  </TouchableOpacity>
                )}
                
                {selectedPhoto.location && (
                  <TouchableOpacity
                    style={styles.proceedButton}
                    onPress={proceedToUpload}
                  >
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                    <Text style={styles.buttonText}>次へ進む</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            // 写真選択ボタン
            <View style={styles.pickerContainer}>
              <Ionicons name="images" size={80} color="#666" />
              <Text style={styles.pickerTitle}>写真を選択してください</Text>
              <Text style={styles.pickerSubtitle}>
                位置情報が含まれた写真を選択すると{'\n'}自動で撮影場所が設定されます
              </Text>
              
              <TouchableOpacity
                style={styles.pickButton}
                onPress={pickImage}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="folder-open" size={20} color="#fff" />
                    <Text style={styles.buttonText}>ギャラリーから選択</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* 位置選択モーダル */}
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowLocationPicker(false)}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <Text style={styles.modalCloseButton}>キャンセル</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>撮影場所を選択</Text>
              <TouchableOpacity onPress={confirmLocation} disabled={!manualLocation}>
                <Text style={[styles.modalConfirmButton, !manualLocation && styles.disabledButton]}>
                  確定
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.mapInstruction}>
              地図をタップして撮影場所をマークしてください
            </Text>

            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={mapRegion}
              onPress={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                setManualLocation({
                  latitude,
                  longitude,
                  timestamp: Date.now(),
                });
              }}
            >
              {manualLocation && (
                <Marker
                  coordinate={{
                    latitude: manualLocation.latitude,
                    longitude: manualLocation.longitude,
                  }}
                  title="撮影場所"
                  description={`${manualLocation.latitude.toFixed(6)}, ${manualLocation.longitude.toFixed(6)}`}
                />
              )}
            </MapView>
          </SafeAreaView>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  pickerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  photoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  selectedPhoto: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationStatus: {
    marginBottom: 16,
  },
  locationFound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
  },
  actionButtons: {
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC107',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    gap: 8,
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalConfirmButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    color: '#ccc',
  },
  mapInstruction: {
    backgroundColor: '#fff',
    padding: 16,
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
});