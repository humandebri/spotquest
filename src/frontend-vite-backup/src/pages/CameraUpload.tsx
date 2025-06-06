import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AuthGuard,
  PageContainer,
  Card,
  Button,
  Alert,
  ProgressBar
} from '../components';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number; // 方角
  speed?: number;
  timestamp: number;
}

interface DeviceOrientation {
  alpha: number; // z軸周りの回転（0-360）
  beta: number;  // x軸周りの回転（-180 to 180）
  gamma: number; // y軸周りの回転（-90 to 90）
}

export default function CameraUpload() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [orientation, setOrientation] = useState<DeviceOrientation | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  
  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  // 位置情報の権限を明示的にリクエストする関数
  const requestLocationPermission = async () => {
    try {
      // 最初に getCurrentPosition を呼び出して権限ダイアログを表示
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined,
        timestamp: position.timestamp
      });
      
      // その後、watchPosition を開始
      startWatchingLocation();
      setError(null);
    } catch (error: any) {
      console.error('Permission request failed:', error);
      setError('Location permission denied or unavailable');
    }
  };

  // 位置情報の監視を開始
  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp
        });
      },
      (error) => {
        setError(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    // Store watchId for cleanup
    (window as any).locationWatchId = watchId;
  };

  // Cleanup location watch on unmount
  useEffect(() => {
    return () => {
      if ((window as any).locationWatchId) {
        navigator.geolocation.clearWatch((window as any).locationWatchId);
      }
    };
  }, []);

  // デバッグ用のログ追加
  useEffect(() => {
    console.log('Navigator object:', navigator);
    console.log('Geolocation available:', 'geolocation' in navigator);
    console.log('Protocol:', location.protocol);
    console.log('User Agent:', navigator.userAgent);
    
    // iOS かどうかを判定
    console.log('Is iOS:', isIOS);
    
    if (isIOS) {
      // iOS の場合は特別な処理
      console.log('iOS detected, using specific handling...');
    }
  }, []);

  // デバイスの方角を取得
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        setOrientation({
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma
        });
      }
    };

    // iOS では権限リクエストが必要
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch((error: Error) => {
          console.error('Orientation permission error:', error);
        });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // カメラを起動
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCapturing(true);
      setError(null);
    } catch (err) {
      setError('Unable to access camera. Please ensure you have granted camera permissions.');
      console.error('Camera error:', err);
    }
  };

  // カメラを停止
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCapturing(false);
    }
  };

  // カメラを切り替え
  const switchCamera = () => {
    stopCamera();
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
  };

  // 写真を撮影
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !location) {
      setError('Please wait for location data before capturing');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // ビデオのアスペクト比を維持してキャンバスサイズを設定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // ビデオフレームをキャンバスに描画
    context.drawImage(video, 0, 0);

    // 位置情報とメタデータをオーバーレイ（オプション）
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, canvas.height - 80, canvas.width, 80);
    
    context.fillStyle = 'white';
    context.font = '14px Arial';
    context.fillText(`Lat: ${location.latitude.toFixed(6)}°`, 10, canvas.height - 50);
    context.fillText(`Lon: ${location.longitude.toFixed(6)}°`, 10, canvas.height - 30);
    context.fillText(`Accuracy: ${location.accuracy.toFixed(1)}m`, 10, canvas.height - 10);
    
    if (orientation) {
      context.fillText(`Direction: ${Math.round(orientation.alpha)}°`, 200, canvas.height - 30);
    }

    // 画像をbase64形式で取得
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  };

  // 画像をアップロード
  const uploadPhoto = async () => {
    if (!capturedImage || !location) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // base64をBlobに変換
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // メタデータを準備
      const metadata = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        heading: orientation?.alpha || 0,
        timestamp: location.timestamp,
        deviceOrientation: orientation
      };

      // TODO: 実際のアップロード処理を実装
      // シミュレーション
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadProgress(i);
      }

      // アップロード成功後、Uploadページにリダイレクト
      navigate('/upload', { 
        state: { 
          photoData: blob,
          metadata 
        } 
      });
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // 再撮影
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <AuthGuard>
      <PageContainer title="Capture Photo" subtitle="Take a photo with location data">
        <div className="max-w-4xl mx-auto">
          <Card padding="large">
            {/* ロケーション情報 */}
            {location && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">Location Acquired</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                  <div>Latitude: {location.latitude.toFixed(6)}°</div>
                  <div>Longitude: {location.longitude.toFixed(6)}°</div>
                  <div>Accuracy: ±{location.accuracy.toFixed(1)}m</div>
                  {orientation && (
                    <div>Direction: {Math.round(orientation.alpha)}°</div>
                  )}
                </div>
              </div>
            )}

            {/* UIに権限リクエストボタンを追加 */}
            {!location && (
              <Alert type="info" className="mb-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Location permission is required to tag your photos.</p>
                  <Button
                    onClick={requestLocationPermission}
                    size="small"
                    variant="primary"
                  >
                    Enable Location
                  </Button>
                </div>
              </Alert>
            )}

            {/* エラー表示 */}
            {error && (
              <Alert type="error" className="mb-6">
                {error}
              </Alert>
            )}

            {/* カメラビューまたは撮影済み画像 */}
            <div className="relative mb-6">
              {capturedImage ? (
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full rounded-lg"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                    style={{ display: isCapturing ? 'block' : 'none' }}
                  />
                  {!isCapturing && (
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                      <Button onClick={startCamera} size="large">
                        Start Camera
                      </Button>
                    </div>
                  )}
                </>
              )}
              
              {/* カメラ切り替えボタン */}
              {isCapturing && !capturedImage && (
                <button
                  onClick={switchCamera}
                  className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* 隠しキャンバス */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* アクションボタン */}
            <div className="flex gap-4">
              {!capturedImage ? (
                <>
                  {isCapturing && (
                    <Button
                      onClick={capturePhoto}
                      disabled={!location}
                      fullWidth
                      size="large"
                      variant="primary"
                    >
                      {location ? 'Capture Photo' : 'Waiting for location...'}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={retakePhoto}
                    variant="secondary"
                    size="large"
                    fullWidth
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={uploadPhoto}
                    disabled={isUploading}
                    loading={isUploading}
                    variant="primary"
                    size="large"
                    fullWidth
                  >
                    Continue
                  </Button>
                </>
              )}
            </div>

            {/* アップロード進捗 */}
            {isUploading && (
              <div className="mt-6">
                <ProgressBar progress={uploadProgress} label="Uploading..." />
              </div>
            )}

            {/* 説明文 */}
            <Alert type="info" className="mt-6">
              <p className="text-sm">
                Your photo will be tagged with GPS coordinates and compass direction. 
                This data will be used to create location-based challenges for other players.
              </p>
            </Alert>
          </Card>
        </div>
      </PageContainer>
    </AuthGuard>
  );
}