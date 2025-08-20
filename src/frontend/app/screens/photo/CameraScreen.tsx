import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { safeUnsubscribe } from '../../utils/subscriptionHelper';

type CameraScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export default function CameraScreen() {
  const navigation = useNavigation<CameraScreenNavigationProp>();
  const cameraRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // センサー監視用のrefs
  const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const deviceMotionSubscriptionRef = useRef<any>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // カメラと位置情報の権限をリクエスト
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      // カメラ権限
      if (!permission?.granted) {
        await requestPermission();
      }

      // 位置情報権限
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus.status === 'granted');

      if (locationStatus.status === 'granted' && isMounted) {
        startLocationTracking();
        startDeviceMotionTracking();
      } else {
        setLocationError('位置情報の権限が必要です');
      }
    })();

    return () => {
      isMounted = false;
      
      // 各subscriptionを安全にクリーンアップ
      safeUnsubscribe(headingSubscriptionRef.current, 'heading');
      safeUnsubscribe(deviceMotionSubscriptionRef.current, 'deviceMotion');
      safeUnsubscribe(locationSubscriptionRef.current, 'location');
      
      // Clear refs
      headingSubscriptionRef.current = null;
      deviceMotionSubscriptionRef.current = null;
      locationSubscriptionRef.current = null;
    };
  }, []);

  // 位置情報の追跡を開始
  const startLocationTracking = async () => {
    try {
      // Check if Location module exists
      if (!Location || typeof Location.getCurrentPositionAsync !== 'function') {
        console.error('Location module not available');
        setLocationError('位置情報サービスが利用できません');
        return;
      }
      // まず粗い推定を素早く取得
      const quickLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log('📍 Quick location obtained:', {
        latitude: quickLocation.coords.latitude,
        longitude: quickLocation.coords.longitude,
        accuracy: quickLocation.coords.accuracy,
      });

      setLocation({
        latitude: quickLocation.coords.latitude,
        longitude: quickLocation.coords.longitude,
        accuracy: quickLocation.coords.accuracy,
        altitude: quickLocation.coords.altitude,
        heading: quickLocation.coords.heading,
        speed: quickLocation.coords.speed,
        timestamp: quickLocation.timestamp,
      });

      // その後、高精度ウォッチで置き換え
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Platform.OS === 'ios'
              ? Location.Accuracy.BestForNavigation
              : Location.Accuracy.Highest,
            timeInterval: 3000,
            distanceInterval: 0,
          },
          (newLocation) => {
            console.log('📍 Watch location update:', {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
            });

            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              altitude: newLocation.coords.altitude,
              heading: newLocation.coords.heading,
              speed: newLocation.coords.speed,
              timestamp: newLocation.timestamp,
            });
            setLocationError(null);
          }
        );
        
        // subscriptionが有効な場合のみrefに格納
        if (subscription) {
          locationSubscriptionRef.current = subscription;
          console.log('✅ Location watch subscription created');
        }
      } catch (error) {
        console.error('Failed to create location watch subscription:', error);
      }
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('位置情報の取得に失敗しました');
    }
  };

  // 角度を0-360度に正規化する関数
  const normalizeDeg = (deg: number): number => {
    // modulo演算で確実に0-360の範囲に収める
    return ((deg % 360) + 360) % 360;
  };

  // 画面の向きに応じた方位角補正
  const getOrientationOffset = (orientation: ScreenOrientation.Orientation): number => {
    switch (orientation) {
      case ScreenOrientation.Orientation.PORTRAIT_UP:        // ホームバー下（通常の縦向き）
        return 90;
      case ScreenOrientation.Orientation.PORTRAIT_DOWN:      // 端末上下逆さ
        return 270;
      case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:    // ホームバー右
        return 0;
      case ScreenOrientation.Orientation.LANDSCAPE_LEFT:     // ホームバー左
        return 180;
      default:
        return 90; // デフォルトは縦向き
    }
  };

  // DeviceMotionを使った高精度方位角追跡（垂直保持対応）
  const startDeviceMotionTracking = async () => {
    try {
      // Check if DeviceMotion module exists
      if (!DeviceMotion || typeof DeviceMotion.isAvailableAsync !== 'function') {
        console.log('DeviceMotion module not available, falling back to Location API');
        startHeadingTracking();
        return;
      }
      
      // DeviceMotionが利用可能かチェック
      const isAvailable = await DeviceMotion.isAvailableAsync();
      if (!isAvailable) {
        console.log('DeviceMotion not available on this device, falling back to Location API');
        startHeadingTracking();
        return;
      }

      // DeviceMotionの設定と監視開始
      DeviceMotion.setUpdateInterval(100); // 10Hz更新

      try {
        const subscription = DeviceMotion.addListener(async (motionData) => {
          if (!motionData || !motionData.rotation) {
            return;
          }
          if (motionData.rotation && motionData.rotation.alpha !== null) {
            // rotation.alpha はラジアンで提供される（範囲: -π to π）
            // 符号をそのまま使用
            const yawDeg = motionData.rotation.alpha * (180 / Math.PI);

            try {
              // 現在の画面の向きを取得
              let orientation = ScreenOrientation.Orientation.PORTRAIT_UP; // Default
              if (ScreenOrientation && typeof ScreenOrientation.getOrientationAsync === 'function') {
                orientation = await ScreenOrientation.getOrientationAsync();
              }

              // オフセットを取得して適用
              const offset = getOrientationOffset(orientation);
              // 180度のオフセット補正を追加（南北を正しく表示）
              const compassHeading = normalizeDeg(180 - yawDeg + offset);

              setHeading(Math.round(compassHeading));
            } catch (orientationError) {
              // ScreenOrientationが使えない場合は、縦向き固定として90度補正
              console.log('Using fixed portrait orientation correction');
              // 180度のオフセット補正を追加（南北を正しく表示）
              const compassHeading = normalizeDeg(yawDeg + 90 - 180);
              setHeading(Math.round(compassHeading));
            }
          }
        });

        // subscriptionが有効な場合のみrefに格納
        if (subscription && typeof subscription === 'object' && 'remove' in subscription) {
          deviceMotionSubscriptionRef.current = subscription;
          console.log('✅ DeviceMotion subscription created');
        } else {
          console.log('⚠️ DeviceMotion subscription is invalid, falling back');
          startHeadingTracking();
        }
      } catch (subscriptionError) {
        console.error('Failed to create DeviceMotion subscription:', subscriptionError);
        startHeadingTracking();
      }
    } catch (error) {
      console.error('DeviceMotion tracking error:', error);
      // フォールバック: Location APIを使用
      startHeadingTracking();
    }
  };

  // フォールバック用のLocation API方位角追跡
  const startHeadingTracking = async () => {
    try {
      // Check if Location module exists and has watchHeadingAsync
      if (!Location || typeof Location.watchHeadingAsync !== 'function') {
        console.error('Location.watchHeadingAsync not available');
        setLocationError('方位角の取得がサポートされていません');
        return;
      }
      try {
        const subscription = await Location.watchHeadingAsync((headingData) => {
          if (!headingData) {
            return;
          }
          const { trueHeading, magHeading } = headingData;
          // iOS: trueHeading があれば優先（磁北⇨真北補正済み）
          // Android: magHeading のみだが OS 補正がかかる
          const actualHeading = trueHeading ?? magHeading;
          setHeading(Math.round(actualHeading));
        });

        // subscriptionが有効な場合のみrefに格納
        if (subscription && typeof subscription === 'object' && 'remove' in subscription) {
          headingSubscriptionRef.current = subscription;
          console.log('✅ Heading watch subscription created');
        } else {
          console.log('⚠️ Heading subscription is invalid');
        }
      } catch (watchError) {
        console.error('Failed to create heading watch subscription:', watchError);
        setLocationError('方位角の監視に失敗しました');
      }
    } catch (error) {
      console.error('Heading tracking error:', error);
      setLocationError('方位角の取得に失敗しました');
    }
  };

  // ギャラリーへの遷移
  const openPhotoLibrary = () => {
    navigation.navigate('PhotoLibrary');
  };

  // 写真を撮影
  const takePicture = async () => {
    if (!cameraRef.current || typeof cameraRef.current.takePictureAsync !== 'function') {
      console.error('Camera ref not ready or takePictureAsync not available');
      return;
    }

    if (!location) {
      Alert.alert('エラー', '位置情報が取得できていません');
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      // 写真データと位置情報を処理
      const photoData = {
        uri: photo.uri,
        base64: photo.base64,
        width: photo.width,
        height: photo.height,
        metadata: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          heading: heading || location.heading,
          timestamp: Date.now(),
        },
      };

      console.log('Photo captured with location:', photoData.metadata);

      // 有効な方位角のみを渡す（0-360度の範囲チェック）
      const getValidAzimuth = (h1: number | null, h2: number | null): number | null => {
        const heading1 = h1;
        const heading2 = h2;
        
        // h1が有効な範囲内（0-360度）かチェック
        if (heading1 !== null && heading1 >= 0 && heading1 <= 360) {
          return heading1;
        }
        
        // h2が有効な範囲内（0-360度）かチェック
        if (heading2 !== null && heading2 >= 0 && heading2 <= 360) {
          return heading2;
        }
        
        // どちらも無効な場合はnullを返す
        return null;
      };

      const validAzimuth = getValidAzimuth(heading, location.heading);

      console.log('📸 Navigating to PhotoUpload with coordinates:', {
        latitude: location.latitude,
        longitude: location.longitude,
        azimuth: validAzimuth,
        timestamp: Date.now(),
      });

      // 写真アップロード画面に遷移
      navigation.navigate('PhotoUpload', {
        photoUri: photo.uri,
        latitude: location.latitude,
        longitude: location.longitude,
        azimuth: validAzimuth,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('エラー', '写真の撮影に失敗しました');
    } finally {
      setIsCapturing(false);
    }
  };


  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3282b8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.permissionContainer}>
          <Text style={styles.errorText}>カメラへのアクセスが拒否されました</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>カメラの権限を許可する</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={28} color="#ffffff" />
        <Text style={styles.backButtonText}>Home</Text>
      </TouchableOpacity>

      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={cameraRef} />
        <View style={[StyleSheet.absoluteFillObject, styles.overlay]}>
          {/* 位置情報表示 */}
          <View style={styles.locationInfo}>
            {location ? (
              <>
                <Text style={styles.locationText}>
                  📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  精度: ±{location.accuracy?.toFixed(0)}m
                </Text>
                {heading !== null && (
                  <Text style={styles.locationText}>
                    🧭 方位: {heading}°
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.locationText}>
                {locationError || '位置情報を取得中...'}
              </Text>
            )}
          </View>

          {/* カメラコントロール */}
          <View style={styles.controls}>
            {/* ギャラリーボタン */}
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={openPhotoLibrary}
            >
              <Ionicons name="images" size={24} color="#ffffff" />
            </TouchableOpacity>

            {/* 撮影ボタン */}
            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={isCapturing || !location}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {/* スペーサー（バランス調整用） */}
            <View style={styles.galleryButton} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 24,
    zIndex: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  locationInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    marginTop: 80,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 10,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 5,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 30,
    paddingHorizontal: 30,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3282b8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});