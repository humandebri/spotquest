import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard, PageContainer, Button, Alert, PermissionDialog, LocationPermissionHelper } from '../components'
import usePermissions from '../hooks/usePermissions'
import { useLocationTracking } from '../hooks/useLocationTracking'

interface CameraPageState {
  isInitializing: boolean
  isCapturing: boolean
  capturedPhoto: Blob | null
  previewUrl: string | null
  showPermissionDialog: boolean
  permissionType: 'camera' | 'location' | 'both'
}


const getCompassDirection = (heading: number): string => {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
  const index = Math.round(heading / 45) % 8
  return directions[index]
}

export default function Camera() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const {
    cameraPermission,
    locationPermission,
    error: permissionError,
    requestCameraPermission,
    requestLocationPermission,
    requestBothPermissions,
    getDeviceOrientation
  } = usePermissions()

  // Use location tracking hook
  const {
    location: trackedLocation,
    isTracking,
    error: locationError,
    startTracking,
    stopTracking,
    getCurrentPosition
  } = useLocationTracking({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    autoStart: false // We'll start manually after permission
  })

  const [state, setState] = useState<CameraPageState>({
    isInitializing: false,
    isCapturing: false,
    capturedPhoto: null,
    previewUrl: null,
    showPermissionDialog: false,
    permissionType: 'both'
  })

  const [compass, setCompass] = useState<number | null>(null)

  // iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

  // Debug logging
  useEffect(() => {
    console.log('Navigator object:', navigator)
    console.log('Geolocation available:', 'geolocation' in navigator)
    console.log('Protocol:', location.protocol)
    console.log('User Agent:', navigator.userAgent)
    console.log('Is iOS:', isIOS)
    console.log('Is Safari:', isSafari)
    
    if (isIOS) {
      console.log('iOS detected, using specific handling...')
    }
  }, [])

  // Initialize camera stream
  const initializeCamera = useCallback(async () => {
    setState(prev => ({ ...prev, isInitializing: true }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (err: any) {
      console.error('Failed to initialize camera:', err)
    } finally {
      setState(prev => ({ ...prev, isInitializing: false }))
    }
  }, [])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Explicit location permission request (especially for iOS)
  const requestLocationPermissionExplicit = async () => {
    try {
      console.log('Requesting location permission explicitly...')
      
      // First try to get current position to trigger permission dialog
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        })
      })
      
      console.log('Location permission granted, position:', position)
      
      // Start tracking after permission is granted
      startTracking()
      
      return true
    } catch (error) {
      console.error('Location permission request failed:', error)
      return false
    }
  }

  // Check permissions and show dialog if needed
  useEffect(() => {
    const checkPermissions = async () => {
      const hasCamera = cameraPermission.granted
      const hasLocation = locationPermission.granted

      if (!hasCamera && !hasLocation) {
        setState(prev => ({
          ...prev,
          showPermissionDialog: true,
          permissionType: 'both'
        }))
      } else if (!hasCamera) {
        setState(prev => ({
          ...prev,
          showPermissionDialog: true,
          permissionType: 'camera'
        }))
      } else if (!hasLocation) {
        setState(prev => ({
          ...prev,
          showPermissionDialog: true,
          permissionType: 'location'
        }))
      } else {
        // Both permissions granted, initialize camera
        await initializeCamera()
      }
    }

    checkPermissions()
  }, [cameraPermission.granted, locationPermission.granted, initializeCamera])

  // Start location tracking when permission is granted
  useEffect(() => {
    if (locationPermission.granted && !isTracking) {
      console.log('Starting location tracking...')
      startTracking()
    }
  }, [locationPermission.granted, isTracking, startTracking])

  // Log tracked location updates
  useEffect(() => {
    if (trackedLocation) {
      console.log('Location updated:', {
        latitude: trackedLocation.latitude,
        longitude: trackedLocation.longitude,
        accuracy: trackedLocation.accuracy,
        timestamp: new Date(trackedLocation.timestamp).toISOString()
      })
    }
  }, [trackedLocation])

  // Update compass periodically
  useEffect(() => {
    if (!locationPermission.granted) return

    const updateCompass = async () => {
      const heading = await getDeviceOrientation()
      if (heading !== null) {
        setCompass(heading)
      }
    }

    // Update immediately
    updateCompass()

    // Update every 2 seconds
    const interval = setInterval(updateCompass, 2000)

    return () => clearInterval(interval)
  }, [locationPermission.granted, getDeviceOrientation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      stopTracking()
    }
  }, [stopCamera, stopTracking])

  const handlePermissionAccept = async () => {
    setState(prev => ({ ...prev, showPermissionDialog: false }))
    
    let success = false

    if (state.permissionType === 'both') {
      success = await requestBothPermissions()
    } else if (state.permissionType === 'camera') {
      success = await requestCameraPermission()
    } else {
      success = await requestLocationPermission()
    }

    if (success) {
      // If camera permission was just granted, initialize camera
      if (state.permissionType === 'camera' || state.permissionType === 'both') {
        await initializeCamera()
      }
      
      // Start location tracking after permission
      if (state.permissionType === 'location' || state.permissionType === 'both') {
        // For iOS, use explicit permission request
        if (isIOS) {
          await requestLocationPermissionExplicit()
        } else {
          startTracking()
        }
      }
    } else {
      // Show error if permission was denied
      alert('権限が拒否されました。ブラウザの設定から権限を許可してください。')
    }
  }

  const handlePermissionDecline = () => {
    setState(prev => ({ ...prev, showPermissionDialog: false }))
    navigate('/upload') // Go back to upload page
  }

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setState(prev => ({ ...prev, isCapturing: true }))

    try {
      console.log('Starting photo capture process...')
      
      // Use tracked location if available
      let location = trackedLocation
      let orientation = compass
      
      // If no tracked location, try to get current position
      if (!location) {
        console.log('No tracked location, getting current position...')
        location = await getCurrentPosition()
      }
      
      // Try to get fresh compass heading
      if (!orientation) {
        orientation = await getDeviceOrientation()
      }

      console.log('Location data:', location)
      console.log('Orientation data:', orientation)

      // Show warning if no location but continue with capture
      if (!location) {
        const continueWithoutLocation = window.confirm(
          '位置情報が取得できませんでした。\n\n' +
          '位置情報なしで写真を撮影しますか？\n' +
          '（ゲームで使用するには位置情報が必要です）'
        )
        
        if (!continueWithoutLocation) {
          setState(prev => ({ ...prev, isCapturing: false }))
          return
        }
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas context を取得できませんでした')
      }

      // Set canvas size to video dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert canvas to blob
      return new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            throw new Error('写真の生成に失敗しました')
          }

          const previewUrl = URL.createObjectURL(blob)
          
          setState(prev => ({
            ...prev,
            capturedPhoto: blob,
            previewUrl: previewUrl,
            isCapturing: false
          }))

          // Stop camera stream after capture
          stopCamera()

          resolve()
        }, 'image/jpeg', 0.8)
      })
    } catch (err: any) {
      console.error('Photo capture failed:', err)
      alert('写真の撮影に失敗しました: ' + err.message)
      setState(prev => ({ ...prev, isCapturing: false }))
    }
  }

  const retakePhoto = () => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }
    
    setState(prev => ({
      ...prev,
      capturedPhoto: null,
      previewUrl: null
    }))

    // Restart camera
    initializeCamera()
  }

  const usePhoto = async () => {
    if (!state.capturedPhoto) return

    try {
      // Use tracked location or get fresh one
      let location = trackedLocation || await getCurrentPosition()
      let orientation = compass || await getDeviceOrientation()

      if (!location) {
        alert('位置情報が取得できません。\n\n位置情報の設定を確認してください：\n1. ブラウザの設定で位置情報を許可\n2. デバイスの位置情報サービスをON\n3. HTTPSでアクセスしているか確認')
        return
      }

      // Navigate to upload page with photo data
      navigate('/upload', {
        state: {
          photoData: state.capturedPhoto,
          metadata: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            heading: orientation || 0,
            timestamp: location.timestamp || Date.now()
          }
        }
      })
    } catch (err: any) {
      console.error('Failed to use photo:', err)
      alert('写真データの準備に失敗しました: ' + err.message)
    }
  }

  return (
    <AuthGuard>
      <PageContainer 
        title="Take Photo" 
        subtitle="Capture a photo with location data for the game"
        maxWidth="lg"
      >
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Permission Dialog */}
          <PermissionDialog
            isOpen={state.showPermissionDialog}
            onClose={handlePermissionDecline}
            onAccept={handlePermissionAccept}
            permission={state.permissionType}
          />

          {/* Error Display */}
          {(permissionError || locationError) && (
            <Alert type="error" title="エラー" className="m-4">
              {permissionError || locationError}
            </Alert>
          )}

          {/* Camera View */}
          <div className="relative bg-black">
            {state.isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p>カメラを初期化しています...</p>
                </div>
              </div>
            )}

            {/* Video Preview */}
            {!state.capturedPhoto && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-96 object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror for selfie mode
              />
            )}

            {/* Photo Preview */}
            {state.capturedPhoto && state.previewUrl && (
              <img
                src={state.previewUrl}
                alt="Captured photo"
                className="w-full h-96 object-cover"
              />
            )}

            {/* Canvas for photo capture (hidden) */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Controls */}
            <div className="absolute bottom-4 left-0 right-0">
              {/* Location Status */}
              {!state.capturedPhoto && !trackedLocation && isTracking && (
                <div className="text-center mb-2">
                  <div className="inline-flex items-center bg-yellow-500 bg-opacity-80 text-white px-3 py-1 rounded-full text-sm">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    位置情報を取得中...
                  </div>
                </div>
              )}
              
              <div className="flex justify-center space-x-4">
                {!state.capturedPhoto ? (
                  <Button
                    onClick={capturePhoto}
                    disabled={state.isCapturing || state.isInitializing || !cameraPermission.granted}
                    loading={state.isCapturing}
                    size="large"
                    className="bg-white text-gray-900 hover:bg-gray-100"
                  >
                    {state.isCapturing ? '処理中...' : '撮影'}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={retakePhoto}
                      variant="secondary"
                      size="large"
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                      再撮影
                    </Button>
                    <Button
                      onClick={usePhoto}
                      variant="primary"
                      size="large"
                      disabled={!trackedLocation}
                    >
                      {trackedLocation ? 'この写真を使用' : '位置情報が必要です'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Information Panel */}
          <div className="p-4 space-y-4">
            {/* iOS-specific alert */}
            {isIOS && !trackedLocation && !isTracking && (
              <Alert type="info" title="iOS Safari での位置情報">
                <div className="space-y-2">
                  <p className="text-sm">
                    位置情報を使用するには以下の設定を確認してください：
                  </p>
                  <ol className="text-sm list-decimal list-inside space-y-1">
                    <li>設定 → Safari → 位置情報 を「許可」に設定</li>
                    <li>設定 → プライバシー → 位置情報サービス をオンに設定</li>
                    <li>下のボタンをタップして位置情報を許可</li>
                  </ol>
                  <Button
                    variant="primary"
                    size="small"
                    onClick={requestLocationPermissionExplicit}
                    fullWidth
                  >
                    位置情報を有効にする
                  </Button>
                </div>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    cameraPermission.granted ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-700">
                    カメラ
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {cameraPermission.granted ? '許可済み' : '未許可'}
                </p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    locationPermission.granted ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-700">
                    位置情報
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {locationPermission.granted ? '許可済み' : '未許可'}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">現在の位置情報</h4>
              
              {isTracking && !trackedLocation ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                  <span className="text-sm text-gray-600">位置情報を取得中...</span>
                </div>
              ) : locationError ? (
                <LocationPermissionHelper
                  error={locationError}
                  isIOS={isIOS}
                  onRetry={requestLocationPermissionExplicit}
                />
              ) : trackedLocation ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">緯度:</span>
                    <span className="ml-1 font-mono">{trackedLocation.latitude.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-gray-500">経度:</span>
                    <span className="ml-1 font-mono">{trackedLocation.longitude.toFixed(6)}°</span>
                  </div>
                  <div>
                    <span className="text-gray-500">精度:</span>
                    <span className="ml-1 font-mono">±{trackedLocation.accuracy.toFixed(0)}m</span>
                  </div>
                  <div>
                    <span className="text-gray-500">方角:</span>
                    <span className="ml-1 font-mono">
                      {compass !== null 
                        ? `${compass.toFixed(0)}° ${getCompassDirection(compass)}`
                        : '取得中...'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-500 mb-2">
                    位置情報が許可されていません
                  </div>
                  <div className="space-y-2">
                    <Button
                      size="small"
                      variant="primary"
                      onClick={requestLocationPermissionExplicit}
                      fullWidth
                    >
                      位置情報を許可
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        // TODO: 手動入力モーダルを開く
                        console.log('Manual location input')
                      }}
                      fullWidth
                    >
                      手動で位置を入力
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Alert type="info" title="撮影のコツ">
              <ul className="text-sm space-y-1">
                <li>• 特徴的な建物や風景を含めてください</li>
                <li>• 明るい場所で撮影してください</li>
                <li>• 推理が楽しくなるような角度を選んでください</li>
              </ul>
            </Alert>
          </div>
        </div>
      </PageContainer>
    </AuthGuard>
  )
}