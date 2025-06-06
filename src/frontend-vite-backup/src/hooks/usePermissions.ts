import { useState, useCallback } from 'react'

interface PermissionState {
  granted: boolean
  denied: boolean
  prompt: boolean
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  heading?: number
  timestamp: number
}

interface UsePermissionsReturn {
  cameraPermission: PermissionState
  locationPermission: PermissionState
  requesting: boolean
  error: string | null
  requestCameraPermission: () => Promise<boolean>
  requestLocationPermission: () => Promise<boolean>
  requestBothPermissions: () => Promise<boolean>
  getCurrentLocation: () => Promise<LocationData | null>
  getDeviceOrientation: () => Promise<number | null>
}

export default function usePermissions(): UsePermissionsReturn {
  const [cameraPermission, setCameraPermission] = useState<PermissionState>({
    granted: false,
    denied: false,
    prompt: true
  })
  
  const [locationPermission, setLocationPermission] = useState<PermissionState>({
    granted: false,
    denied: false,
    prompt: true
  })
  
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('カメラがサポートされていません')
      }

      // Check if permission is already granted
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (permission.state === 'granted') {
            setCameraPermission({ granted: true, denied: false, prompt: false })
            return true
          } else if (permission.state === 'denied') {
            setCameraPermission({ granted: false, denied: true, prompt: false })
            return false
          }
        } catch (e) {
          // Some browsers don't support permissions.query for camera
          console.warn('Permissions API not supported for camera')
        }
      }

      return false
    } catch (err) {
      console.error('Camera permission check failed:', err)
      return false
    }
  }, [])

  const checkLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.geolocation) {
        throw new Error('位置情報がサポートされていません')
      }

      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'granted') {
            setLocationPermission({ granted: true, denied: false, prompt: false })
            return true
          } else if (permission.state === 'denied') {
            setLocationPermission({ granted: false, denied: true, prompt: false })
            return false
          }
        } catch (e) {
          console.warn('Permissions API not supported for geolocation')
        }
      }

      return false
    } catch (err) {
      console.error('Location permission check failed:', err)
      return false
    }
  }, [])

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    setRequesting(true)
    setError(null)

    try {
      const alreadyGranted = await checkCameraPermission()
      if (alreadyGranted) {
        setRequesting(false)
        return true
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      })
      
      // Stop the stream immediately as we just wanted to check permission
      stream.getTracks().forEach(track => track.stop())
      
      setCameraPermission({ granted: true, denied: false, prompt: false })
      setRequesting(false)
      return true
    } catch (err: any) {
      console.error('Camera permission failed:', err)
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermission({ granted: false, denied: true, prompt: false })
        setError('カメラの使用が拒否されました。ブラウザの設定から許可してください。')
      } else if (err.name === 'NotFoundError') {
        setError('カメラが見つかりません。')
      } else {
        setError('カメラアクセスに失敗しました: ' + err.message)
      }
      
      setRequesting(false)
      return false
    }
  }, [checkCameraPermission])

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    console.log('Requesting location permission...')
    setRequesting(true)
    setError(null)

    try {
      const alreadyGranted = await checkLocationPermission()
      if (alreadyGranted) {
        console.log('Location permission already granted')
        setRequesting(false)
        return true
      }

      return new Promise((resolve) => {
        console.log('Calling getCurrentPosition...')
        
        const options: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
        
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Location permission granted, position:', position.coords)
            setLocationPermission({ granted: true, denied: false, prompt: false })
            setRequesting(false)
            resolve(true)
          },
          (err) => {
            console.error('Location permission failed:', {
              code: err.code,
              message: err.message,
              PERMISSION_DENIED: err.PERMISSION_DENIED,
              POSITION_UNAVAILABLE: err.POSITION_UNAVAILABLE,
              TIMEOUT: err.TIMEOUT
            })
            
            if (err.code === err.PERMISSION_DENIED) {
              setLocationPermission({ granted: false, denied: true, prompt: false })
              setError('位置情報の使用が拒否されました。ブラウザの設定から許可してください。')
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              setError('位置情報が利用できません。')
            } else if (err.code === err.TIMEOUT) {
              setError('位置情報の取得がタイムアウトしました。')
            } else {
              setError('位置情報の取得に失敗しました: ' + err.message)
            }
            
            setRequesting(false)
            resolve(false)
          },
          options
        )
      })
    } catch (err: any) {
      console.error('Location permission request failed:', err)
      setError('位置情報アクセスに失敗しました: ' + err.message)
      setRequesting(false)
      return false
    }
  }, [checkLocationPermission])

  const requestBothPermissions = useCallback(async (): Promise<boolean> => {
    const cameraResult = await requestCameraPermission()
    const locationResult = await requestLocationPermission()
    
    return cameraResult && locationResult
  }, [requestCameraPermission, requestLocationPermission])

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    // Check if we're in HTTPS context (required for geolocation)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('位置情報の取得にはHTTPS接続が必要です')
      return null
    }

    if (!navigator.geolocation) {
      setError('このブラウザは位置情報をサポートしていません')
      return null
    }

    if (!locationPermission.granted) {
      const granted = await requestLocationPermission()
      if (!granted) {
        setError('位置情報の使用が許可されていません')
        return null
      }
    }

    return new Promise((resolve) => {
      console.log('Requesting current position...')
      
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 30000, // 30 seconds
        maximumAge: 0 // Always get fresh location
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Position obtained:', position.coords)
          
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || undefined,
            timestamp: position.timestamp
          }
          
          resolve(locationData)
        },
        (err) => {
          console.error('Geolocation error:', err)
          
          let errorMessage = '位置情報の取得に失敗しました: '
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage += '位置情報の使用が拒否されました'
              break
            case err.POSITION_UNAVAILABLE:
              errorMessage += '位置情報が利用できません'
              break
            case err.TIMEOUT:
              errorMessage += 'タイムアウトしました'
              break
            default:
              errorMessage += err.message
          }
          
          setError(errorMessage)
          resolve(null)
        },
        options
      )
    })
  }, [locationPermission.granted, requestLocationPermission])

  const getDeviceOrientation = useCallback(async (): Promise<number | null> => {
    try {
      // Check if we're in HTTPS context (required for device orientation)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setError('方角の取得にはHTTPS接続が必要です')
        return null
      }

      // For iOS 13+, request permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        console.log('Requesting device orientation permission...')
        const permission = await (DeviceOrientationEvent as any).requestPermission()
        console.log('Device orientation permission:', permission)
        
        if (permission !== 'granted') {
          setError('デバイスの向き情報の使用が拒否されました')
          return null
        }
      }

      return new Promise((resolve) => {
        let hasData = false
        let attempts = 0
        const maxAttempts = 10

        const handleOrientation = (event: DeviceOrientationEvent) => {
          attempts++
          console.log('Device orientation event:', {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            absolute: event.absolute,
            attempts
          })
          
          if (event.alpha !== null && event.alpha !== undefined) {
            hasData = true
            
            // alpha is the compass direction the device is facing
            // Convert to compass heading (0-360) where 0 = North
            let heading = 360 - event.alpha
            
            // Normalize to 0-360 range
            while (heading < 0) heading += 360
            while (heading >= 360) heading -= 360
            
            window.removeEventListener('deviceorientation', handleOrientation)
            window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation)
            
            console.log('Compass heading:', heading)
            resolve(Math.round(heading))
          } else if (attempts >= maxAttempts) {
            // Stop trying after max attempts
            window.removeEventListener('deviceorientation', handleOrientation)
            window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation)
            
            if (!hasData) {
              console.warn('No orientation data after', maxAttempts, 'attempts')
              setError('方角データが取得できませんでした。デバイスが対応していない可能性があります。')
              resolve(null)
            }
          }
        }

        const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
          console.log('Absolute orientation event:', {
            alpha: event.alpha,
            absolute: event.absolute
          })
          
          if (event.absolute && event.alpha !== null && event.alpha !== undefined) {
            hasData = true
            window.removeEventListener('deviceorientation', handleOrientation)
            window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation)
            
            let heading = 360 - event.alpha
            while (heading < 0) heading += 360
            while (heading >= 360) heading -= 360
            
            console.log('Absolute compass heading:', heading)
            resolve(Math.round(heading))
          }
        }

        // Try both events
        window.addEventListener('deviceorientation', handleOrientation)
        window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation)
        
        // Timeout after 10 seconds
        setTimeout(() => {
          window.removeEventListener('deviceorientation', handleOrientation)
          window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation)
          
          if (!hasData) {
            console.warn('Device orientation timeout')
            setError('方角の取得がタイムアウトしました')
            resolve(null)
          }
        }, 10000)
      })
    } catch (err: any) {
      console.error('Device orientation failed:', err)
      setError('デバイスの向き情報の取得に失敗しました: ' + err.message)
      return null
    }
  }, [])

  return {
    cameraPermission,
    locationPermission,
    requesting,
    error,
    requestCameraPermission,
    requestLocationPermission,
    requestBothPermissions,
    getCurrentLocation,
    getDeviceOrientation
  }
}