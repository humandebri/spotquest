import { useState, useEffect, useCallback, useRef } from 'react'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  altitudeAccuracy?: number | null
  heading?: number | null
  speed?: number | null
  timestamp: number
}

export interface LocationTrackingState {
  location: LocationData | null
  isTracking: boolean
  error: string | null
  permissionState: 'prompt' | 'granted' | 'denied' | null
}

interface UseLocationTrackingOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  autoStart?: boolean
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000, // 10秒に増やす
    maximumAge = 0,
    autoStart = true
  } = options

  const [state, setState] = useState<LocationTrackingState>({
    location: null,
    isTracking: false,
    error: null,
    permissionState: null
  })

  const watchIdRef = useRef<number | null>(null)

  // デバッグ情報
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost'

  // Check permission state
  const checkPermission = useCallback(async () => {
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        setState(prev => ({ ...prev, permissionState: permission.state as any }))
        
        // Listen for permission changes
        permission.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionState: permission.state as any }))
        })
      }
    } catch (error) {
      console.warn('Permission API not supported:', error)
    }
  }, [])

  // Success callback for geolocation
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    console.log('Location update:', position.coords)
    
    const locationData: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp
    }

    setState(prev => ({
      ...prev,
      location: locationData,
      error: null,
      permissionState: 'granted'
    }))
  }, [])

  // Error callback for geolocation
  const handleError = useCallback((error: GeolocationPositionError) => {
    console.error('Location error:', {
      code: error.code,
      message: error.message,
      PERMISSION_DENIED: error.PERMISSION_DENIED,
      POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
      TIMEOUT: error.TIMEOUT
    })
    
    let errorMessage = '位置情報の取得に失敗しました'
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = '位置情報の使用が拒否されました。設定で位置情報を許可してください。'
        setState(prev => ({ ...prev, permissionState: 'denied' }))
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = '位置情報が利用できません。デバイスの位置情報サービスを確認してください。'
        break
      case error.TIMEOUT:
        errorMessage = '位置情報の取得がタイムアウトしました。電波状況を確認してください。'
        break
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      isTracking: false
    }))
  }, [])

  // Start watching position
  const startTracking = useCallback(() => {
    console.log('[LocationTracking] Starting tracking...', {
      isIOS,
      isHTTPS,
      geolocationAvailable: 'geolocation' in navigator
    })

    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'このブラウザは位置情報をサポートしていません'
      }))
      return
    }

    if (!isHTTPS) {
      setState(prev => ({
        ...prev,
        error: 'HTTPS接続が必要です。HTTPSでアクセスしてください。'
      }))
      return
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    console.log('Starting location tracking with options:', {
      enableHighAccuracy,
      timeout,
      maximumAge
    })
    
    setState(prev => ({ ...prev, isTracking: true, error: null }))

    const options: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    }

    // First try to get current position to trigger permission prompt
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[LocationTracking] Initial position obtained:', position.coords)
        handleSuccess(position)
        
        // Then start watching
        watchIdRef.current = navigator.geolocation.watchPosition(
          handleSuccess,
          handleError,
          options
        )
      },
      (error) => {
        console.error('[LocationTracking] Initial position failed:', error)
        handleError(error)
      },
      options
    )
  }, [enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError, isIOS, isHTTPS])

  // Stop watching position
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      console.log('Stopping location tracking...')
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setState(prev => ({ ...prev, isTracking: false }))
    }
  }, [])

  // Get current position once
  const getCurrentPosition = useCallback(async (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setState(prev => ({
          ...prev,
          error: 'このブラウザは位置情報をサポートしていません'
        }))
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          }
          resolve(locationData)
        },
        (error) => {
          handleError(error)
          resolve(null)
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge: 0
        }
      )
    })
  }, [enableHighAccuracy, timeout, handleError])

  // Auto start if enabled
  useEffect(() => {
    checkPermission()
    
    if (autoStart) {
      startTracking()
    }

    // Cleanup on unmount
    return () => {
      stopTracking()
    }
  }, []) // Only run on mount/unmount

  return {
    location: state.location,
    isTracking: state.isTracking,
    error: state.error,
    permissionState: state.permissionState,
    startTracking,
    stopTracking,
    getCurrentPosition
  }
}