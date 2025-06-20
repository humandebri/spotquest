import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Image,
  Alert,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useGameStore, SessionStatus, SessionInfo } from '../../store/gameStore';
import { useAuth } from '../../hooks/useAuth';
import { gameService, HintType as ServiceHintType, HintData, HintContent } from '../../services/game';
import { photoServiceV2, PhotoMetaV2, PhotoStatsDetailsV2 } from '../../services/photoV2';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 難易度設定
export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
  EXTREME = 'EXTREME',
}

const DifficultySettings = {
  [Difficulty.EASY]: {
    hintCostMultiplier: 0.5,
    scoreMultiplier: 0.8,
    timeLimit: 300, // 5分
    startingZoom: 10,
    maxConfidenceRadius: 500,
  },
  [Difficulty.NORMAL]: {
    hintCostMultiplier: 1.0,
    scoreMultiplier: 1.0,
    timeLimit: 180, // 3分
    startingZoom: 5,
    maxConfidenceRadius: 1000,
  },
  [Difficulty.HARD]: {
    hintCostMultiplier: 1.5,
    scoreMultiplier: 1.5,
    timeLimit: 120, // 2分
    startingZoom: 3,
    maxConfidenceRadius: 2000,
  },
  [Difficulty.EXTREME]: {
    hintCostMultiplier: 2.0,
    scoreMultiplier: 2.0,
    timeLimit: 60, // 1分
    startingZoom: 1,
    maxConfidenceRadius: 5000,
  },
};

interface GamePhoto {
  id: string;
  url: string;
  actualLocation: {
    latitude: number;
    longitude: number;
  };
  azimuth: number;
  timestamp: number;
  uploader: string;
  difficulty: Difficulty;
}

interface Hint {
  id: string;
  type: 'BasicRadius' | 'PremiumRadius' | 'DirectionHint';
  cost: number;
  title: string;
  content?: string;
  unlocked: boolean;
  data?: HintContent;
}

interface GamePlayScreenProps {
  route: RouteProp<RootStackParamList, 'GamePlay'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'GamePlay'>;
}

export default function GamePlayScreen({ route }: GamePlayScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { gameMode = 'normal', difficulty = Difficulty.NORMAL, regionFilter, regionName } = route.params || {};
  
  // Game store
  const { 
    currentPhoto, 
    currentGuess,
    confidenceRadius,
    sessionId,
    sessionStatus,
    userSessions,
    isSessionLoading,
    sessionError,
    tokenBalance,
    purchasedHints,
    roundNumber,
    setCurrentPhoto,
    setGuess: setGameGuess,
    setTimeLeft: setGameTimeLeft,
    setSessionId,
    setSessionStatus,
    setUserSessions,
    setSessionLoading,
    setSessionError,
    setTokenBalance,
    setRoundNumber,
    addPurchasedHint,
    hasActiveSession,
    getActiveSession,
    createNewSession,
    updateSessionStatus,
    clearSessionData,
    resetGame,
  } = useGameStore();
  
  // Auth store
  const { principal, identity } = useAuth();
  
  // ゲーム状態
  const [azimuthGuess, setAzimuthGuess] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DifficultySettings[difficulty].timeLimit);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<PhotoMetaV2 | null>(null);
  const [photoStats, setPhotoStats] = useState<PhotoStatsDetailsV2 | null>(null);
  
  // タイマー管理を改善
  const [hasTimeoutBeenHandled, setHasTimeoutBeenHandled] = useState(false);
  
  // Navigation state guard to prevent re-initialization
  const [hasNavigated, setHasNavigated] = useState(false);
  
  // Combined initialization - gameService and game session
  useEffect(() => {
    const initializeGame = async () => {
      // Wait for both identity and principal, and check navigation guard
      if (!identity || !principal || hasNavigated) {
        return;
      }
      
      // Additional check: if we already have a session and photo for current round, don't re-initialize
      // BUT: validate that this is a valid continuation (roundNumber should be <= 5)
      if (sessionId && currentPhoto && roundNumber > 0) {
        if (roundNumber > 5) {
          // Invalid state - round number exceeds max, force reset
          console.log('🎮 Invalid round number detected:', roundNumber, '- forcing reset');
          resetGame();
        } else {
          console.log('🎮 Skipping re-initialization - already have active game state');
          setIsLoading(false);
          setSessionLoading(false);
          return;
        }
      }
      
      setIsLoading(true);
      setSessionLoading(true);
      setError(null);
      setSessionError(null);
      
      try {
        console.log('🎮 Starting game initialization...');
        
        // Initialize gameService first
        await gameService.init(identity);
        console.log('🎮 GameService initialized');
        
        // Skip getUserSessions - always create new session for game
        // This saves one API call
        setUserSessions([]);
        
        // Create new session directly
        let newSessionId: string | null = null;
        
        if (!sessionId) {
          console.log('🎮 Creating new session...');
          const result = await gameService.createSessionWithCleanup();
          
          if (result.err) {
            throw new Error(result.err);
          }
          
          if (result.ok) {
            newSessionId = result.ok;
            
            // First update user sessions to reflect cleanup
            setUserSessions((prevSessions: SessionInfo[]) => {
              const cleanedSessions = (Array.isArray(prevSessions) ? prevSessions : []).map(session => 
                session.status === 'Active' && session.id !== newSessionId
                  ? { ...session, status: 'Completed' as SessionStatus }
                  : session
              );
              return cleanedSessions;
            });
            
            // Then create the new session
            createNewSession(newSessionId);
            console.log('🎮 New session created after cleanup:', newSessionId);
          }
        }
        
        // Step 3: Get round data and token balance in parallel
        const currentSessionId = sessionId || newSessionId;
        if (currentSessionId) {
          console.log('🎮 Getting round data and token balance for session:', currentSessionId);
          
          // Parallelize round data and token balance fetching with error handling
          const promises = await Promise.allSettled([
            gameService.getNextRound(currentSessionId, regionFilter),
            gameService.getTokenBalance(principal)
          ]);
          
          // Handle round result
          const roundResult = promises[0].status === 'fulfilled' ? promises[0].value : null;
          if (!roundResult) {
            throw new Error('Failed to get round data');
          }
          
          // Handle balance (non-critical, so just log if failed)
          if (promises[1].status === 'fulfilled') {
            setTokenBalance(promises[1].value);
          } else {
            console.warn('Failed to fetch token balance:', promises[1].reason);
          }
          
          if (roundResult.err) {
            throw new Error(roundResult.err);
          }
          
          if (roundResult.ok) {
            const photoId = roundResult.ok.photoId;
            console.log('🎮 Round photo ID:', photoId);
            
            // Fetch photo metadata, complete data, and stats in parallel (only once!)
            const [photoMeta, photoCompleteData, photoStatsData] = await Promise.all([
              photoServiceV2.getPhotoMetadata(photoId, identity),
              photoServiceV2.getPhotoCompleteData(photoId, identity),
              photoServiceV2.getPhotoStatsDetails(photoId, identity)
            ]);
            
            if (photoMeta && photoCompleteData) {
              // Store photo metadata and stats for UI display
              setPhotoMeta(photoMeta);
              setPhotoStats(photoStatsData);
              
              // ✅ Region filtering implementation completed (2025-06-16)
              // Backend's getNextRound function now supports region filtering.
              // Photos are selected from the specified region at the backend level.
              if (regionFilter) {
                const photoRegion = photoMeta.region;
                const photoCountry = photoMeta.country;
                
                // Log region match for verification
                console.log('🎮 Region filter active:', {
                  requested: regionFilter,
                  photoRegion,
                  photoCountry,
                  matches: regionFilter === photoRegion || regionFilter === photoCountry
                });
              }
              
              // Use the already fetched complete photo data
              const combinedChunks = photoCompleteData;
              
              // Convert to base64 data URL
              // まず、データがすでにBase64かバイナリかを確認
              const decoder = new TextDecoder();
              const testChunk = combinedChunks.slice(0, Math.min(100, combinedChunks.length));
              const asText = decoder.decode(testChunk);
              
              let photoUrl = '';
              
              if (asText.includes('data:image') || /^[A-Za-z0-9+/]/.test(asText)) {
                // すでにBase64の場合
                const base64String = decoder.decode(combinedChunks);
                if (base64String.startsWith('data:')) {
                  photoUrl = base64String;
                } else {
                  photoUrl = `data:image/jpeg;base64,${base64String}`;
                }
              } else {
                // バイナリデータの場合、Base64に変換
                const CHUNK_SIZE = 1024; // 1KB chunks
                const binaryChunks: string[] = [];
                
                for (let i = 0; i < combinedChunks.length; i += CHUNK_SIZE) {
                  const end = Math.min(i + CHUNK_SIZE, combinedChunks.length);
                  const chunk = combinedChunks.slice(i, end);
                  
                  let binaryString = '';
                  for (let j = 0; j < chunk.length; j++) {
                    binaryString += String.fromCharCode(chunk[j]);
                  }
                  binaryChunks.push(binaryString);
                }
                
                const fullBinaryString = binaryChunks.join('');
                const base64String = btoa(fullBinaryString);
                photoUrl = `data:image/jpeg;base64,${base64String}`;
              }
              
              setCurrentPhoto({
                id: photoMeta.id.toString(),
                url: photoUrl,
                actualLocation: { 
                  latitude: photoMeta.latitude, 
                  longitude: photoMeta.longitude 
                },
                azimuth: photoMeta.azimuth && photoMeta.azimuth.length > 0 ? photoMeta.azimuth[0] : 0,
                timestamp: Number(photoMeta.uploadTime),
                uploader: photoMeta.owner.toString(),
                difficulty,
              });
            } else {
              // Fallback if photo metadata not found
              console.warn('🎮 Photo metadata not found for ID:', photoId);
              setCurrentPhoto({
                id: photoId.toString(),
                url: 'https://picsum.photos/800/600?' + Date.now(),
                actualLocation: { latitude: 35.6762, longitude: 139.6503 },
                azimuth: 45,
                timestamp: Date.now(),
                uploader: '2vxsx-fae',
                difficulty,
              });
            }
          }
        }
        
        // Token balance already updated in parallel fetch above
        
        setIsLoading(false);
        setSessionLoading(false);
        console.log('🎮 Game initialization completed successfully');
        
      } catch (err) {
        console.error('🎮 Failed to initialize game:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to start game';
        setError(errorMessage);
        setSessionError(errorMessage);
        setIsLoading(false);
        setSessionLoading(false);
        
        // Show error alert with more specific message
        const alertMessage = err instanceof Error && err.message.includes('certificate') 
          ? 'Certificate verification failed. This is a known issue with dev mode on mainnet. Please try using Internet Identity for full functionality.'
          : errorMessage;
          
        Alert.alert(
          'Game Error',
          alertMessage,
          [
            { 
              text: 'Go Back', 
              onPress: () => {
                // Stop timer before navigating
                isNavigatingAway.current = true;
                if (timerRef.current) {
                  clearTimeout(timerRef.current);
                  timerRef.current = null;
                }
                navigation.goBack();
              }
            }
          ]
        );
      }
    };
    
    initializeGame();
  }, [principal, identity]); // Removed regionFilter to avoid re-initialization
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up timer when component unmounts
      isNavigatingAway.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      
      // Finalize session if leaving before completing all 5 rounds
      // This prevents old sessions from continuing when user returns
      if (sessionId && roundNumber < 5 && sessionStatus === 'Active') {
        console.log('🎮 Finalizing incomplete session:', sessionId, 'at round', roundNumber);
        gameService.finalizeSession(sessionId).catch(err => {
          console.error('Failed to finalize session:', err);
        });
        // Update local session status immediately to Completed
        updateSessionStatus(sessionId, 'Completed');
      }
    };
  }, [sessionId, roundNumber, sessionStatus, updateSessionStatus]);
  
  // 画面のフォーカス状態を監視
  useFocusEffect(
    React.useCallback(() => {
      // 画面がフォーカスされた時
      isNavigatingAway.current = false;
      setHasTimeoutBeenHandled(false); // Reset timeout handling flag
      
      // If coming back for a new round, reset navigation guard
      if (hasNavigated && roundNumber > 1) {
        setHasNavigated(false);
      }
      
      // 画面がフォーカスを失った時のクリーンアップ
      return () => {
        isNavigatingAway.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [hasNavigated, roundNumber])
  );
  
  // 画像のアスペクト比を取得
  useEffect(() => {
    if (currentPhoto?.url) {
      Image.getSize(
        currentPhoto.url,
        (width, height) => {
          const ratio = width / height;
          setImageAspectRatio(ratio);
          // 画面のアスペクト比と比較
          const screenRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
          // 横長画像の場合のみパンを有効にする
          setCanPan(ratio > screenRatio);
        },
        (error) => {
          console.error('Failed to get image size:', error);
        }
      );
    }
  }, [currentPhoto]);
  const [hints, setHints] = useState<Hint[]>([
    { id: '1', type: 'BasicRadius', cost: 100, title: '基本範囲ヒント', unlocked: false },
    { id: '2', type: 'PremiumRadius', cost: 300, title: 'プレミアム範囲ヒント', unlocked: false },
    { id: '3', type: 'DirectionHint', cost: 100, title: '方向ヒント', unlocked: false },
  ]);
  
  // UI状態
  const [showHintModal, setShowHintModal] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showCompass, setShowCompass] = useState(true);
  
  // Photo pan and zoom state
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const lastPan = useRef({ x: 0, y: 0 });
  const lastDistance = useRef(0);
  const isZooming = useRef(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(1);
  const [canPan, setCanPan] = useState(false);
  
  // Calculate distance between two touches
  const getDistance = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // PanResponder for dragging and zooming
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Store the current position
        lastPan.current = {
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        };
        lastScale.current = (scale as any)._value;
        
        // Check if it's a pinch gesture
        if (evt.nativeEvent.touches.length === 2) {
          isZooming.current = true;
          lastDistance.current = getDistance(evt.nativeEvent.touches);
        } else {
          isZooming.current = false;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2 && isZooming.current) {
          // Handle pinch zoom
          const distance = getDistance(evt.nativeEvent.touches);
          const scaleDelta = distance / lastDistance.current;
          const newScale = Math.max(0.5, Math.min(3, lastScale.current * scaleDelta));
          
          scale.setValue(newScale);
          
          // Limit scale between 1 and 5
          scale.setValue(Math.max(1, Math.min(5, newScale)));
        } else if (!isZooming.current) {
          // Handle pan
          const currentScale = (scale as any)._value;
          const newX = lastPan.current.x + gestureState.dx;
          const newY = lastPan.current.y + gestureState.dy;
          
          // Calculate image dimensions
          const imageWidth = SCREEN_HEIGHT * imageAspectRatio;
          const imageHeight = SCREEN_HEIGHT;
          
          // Calculate max pan based on zoom level
          let maxX = 0;
          let maxY = 0;
          
          if (currentScale > 1) {
            // When zoomed in, allow panning
            const scaledWidth = imageWidth * currentScale;
            const scaledHeight = imageHeight * currentScale;
            
            maxX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
            maxY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);
          } else if (canPan) {
            // For wide images at normal scale, allow horizontal panning
            maxX = Math.max(0, (imageWidth - SCREEN_WIDTH) / 2);
          }
          
          pan.setValue({
            x: Math.max(-maxX, Math.min(maxX, newX)),
            y: Math.max(-maxY, Math.min(maxY, newY)),
          });
        }
      },
      onPanResponderRelease: () => {
        // Reset zoom if too small
        if ((scale as any)._value < 1) {
          Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
        
        // Center the image if panned too far
        const currentScale = (scale as any)._value;
        const imageWidth = SCREEN_HEIGHT * imageAspectRatio;
        const imageHeight = SCREEN_HEIGHT;
        
        let maxX = 0;
        let maxY = 0;
        
        if (currentScale > 1) {
          const scaledWidth = imageWidth * currentScale;
          const scaledHeight = imageHeight * currentScale;
          
          maxX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
          maxY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);
        } else if (canPan) {
          maxX = Math.max(0, (imageWidth - SCREEN_WIDTH) / 2);
        }
        
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        
        if (Math.abs(currentX) > maxX || Math.abs(currentY) > maxY) {
          Animated.spring(pan, {
            toValue: {
              x: Math.max(-maxX, Math.min(maxX, currentX)),
              y: Math.max(-maxY, Math.min(maxY, currentY)),
            },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
        
        isZooming.current = false;
      },
    })
  ).current;
  
  // タイマー
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingAway = useRef(false);
  
  useEffect(() => {
    // ナビゲート中、写真がない、またはローディング中はタイマーを開始しない
    if (isNavigatingAway.current || !currentPhoto || isLoading) {
      return;
    }
    
    // タイムアウトの処理
    if (timeLeft <= 0 && !hasTimeoutBeenHandled) {
      // タイムアウトハンドラーを一度だけ呼び出す
      if (!isNavigatingAway.current) {
        setHasTimeoutBeenHandled(true);
        handleTimeout();
      }
      return;
    }
    
    // 時間が残っている場合のみタイマーを設定
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        if (!isNavigatingAway.current) {
          setTimeLeft(prev => Math.max(0, prev - 1));
        }
      }, 1000);
    }
    
    // クリーンアップ
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeLeft, hasTimeoutBeenHandled, currentPhoto, isLoading]);
  
  // Calculate distance using Haversine formula (in meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate score based on new criteria (Classic Mode)
  const calculateScore = (distanceInMeters: number): number => {
    const MAX_SCORE = 5000;
    const PERFECT_DISTANCE = 10; // meters

    if (distanceInMeters <= PERFECT_DISTANCE) {
      // Perfect score for distances <= 10 meters
      return MAX_SCORE;
    } else {
      // Exponential decay formula
      const distanceInKm = distanceInMeters / 1000;
      const k = 0.15; // Decay constant calibrated for the scoring table
      const score = MAX_SCORE * Math.exp(-k * distanceInKm);
      
      // Ensure minimum score is 0
      return Math.max(0, Math.round(score));
    }
  };
  
  // Forward declaration of submitGuess for handleTimeout
  const submitGuessRef = useRef<(isTimeout?: boolean) => Promise<void>>();
  
  // Define handleTimeout
  const handleTimeout = () => {
    // Multiple guards to prevent duplicate handling
    if (isNavigatingAway.current || hasNavigated || hasTimeoutBeenHandled) {
      console.log('⏰ Ignoring timeout - already handled');
      return;
    }
    
    console.log('⏰ Game timeout occurred');
    
    // Immediately set all guards before showing alert
    isNavigatingAway.current = true;
    setHasNavigated(true);
    setHasTimeoutBeenHandled(true);
    
    // Clear timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    Alert.alert('時間切れ！', 'ランダムな場所で推測を送信します。', [
      { text: 'OK', onPress: () => submitGuessRef.current && submitGuessRef.current(true) }
    ]);
  };
  
  submitGuessRef.current = async (isTimeout = false) => {
    if (isTimeout) {
      console.log('⏰ submitGuess called from TIMEOUT:', { 
        sessionId, 
        currentGuess, 
        isNavigatingAway: isNavigatingAway.current,
        hasNavigated,
        hasTimeoutBeenHandled
      });
    } else {
      console.log('🎯 submitGuess called from NORMAL FLOW:', { sessionId, currentGuess, isNavigatingAway: isNavigatingAway.current });
    }
    
    // Double-check navigation state and navigation guard
    if (isNavigatingAway.current || hasNavigated) {
      console.log('🎮 Ignoring submitGuess - already navigating or navigated', {
        isNavigatingAway: isNavigatingAway.current,
        hasNavigated
      });
      return;
    }
    
    // Additional check for timeout case
    if (isTimeout && hasTimeoutBeenHandled) {
      console.log('🎮 Ignoring timeout submitGuess - timeout already handled');
      return;
    }
    
    if (!currentGuess && !isTimeout) {
      console.log('🎮 No guess provided, showing alert');
      Alert.alert('エラー', '地図をタップして場所を推測してください');
      return;
    }
    
    const finalGuess = currentGuess || {
      latitude: (Math.random() - 0.5) * 180,
      longitude: (Math.random() - 0.5) * 360,
    };
    
    console.log('🎯 Final guess:', finalGuess);
    
    // Stop timer and set navigation state immediately
    isNavigatingAway.current = true;
    setHasNavigated(true); // Set navigation guard to prevent re-initialization
    setHasTimeoutBeenHandled(true); // Prevent any further timeout handling
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    // Calculate actual score based on distance
    const distance = calculateDistance(
      finalGuess.latitude,
      finalGuess.longitude,
      currentPhoto!.actualLocation.latitude,
      currentPhoto!.actualLocation.longitude
    );
    const score = calculateScore(distance);
    
    
    // Submit guess to backend
    if (sessionId) {
      try {
        console.log('📡 Submitting guess to backend:', {
          sessionId,
          latitude: finalGuess.latitude,
          longitude: finalGuess.longitude,
          azimuthGuess,
          confidenceRadius,
          calculatedScore: score
        });
        
        setSessionLoading(true);
        const result = await gameService.submitGuess(
          sessionId,
          finalGuess.latitude,
          finalGuess.longitude,
          azimuthGuess,
          confidenceRadius
        );
        
        console.log('📡 Backend submitGuess result:', result);
        
        if (result.ok) {
          // Guess submitted successfully
          console.log('✅ Guess submitted successfully to backend');
          
          // Navigate to result screen with backend data
          const backendResult = result.ok;
          console.log('🗺️ Backend returned result:', backendResult);
          
          const resultParams = {
            guess: {
              latitude: finalGuess.latitude,
              longitude: finalGuess.longitude,
            },
            actualLocation: {
              latitude: backendResult.actualLocation.lat,
              longitude: backendResult.actualLocation.lon,
            },
            score: Number(backendResult.displayScore), // Convert BigInt to number for navigation
            timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
            difficulty: difficulty,
            photoUrl: currentPhoto!.url,
          };
          
          console.log('🗺️ Navigating to GameResult with backend data:', {
            ...resultParams,
            photoUrl: resultParams.photoUrl ? '[BASE64_IMAGE_DATA]' : undefined
          });
          
          // Navigate to result screen with backend data using replace to prevent stack issues
          console.log('🚀 Navigating to GameResult...');
          
          // Use setTimeout to ensure all state updates are complete before navigation
          setTimeout(() => {
            navigation.replace('GameResult', resultParams);
          }, 100);
          
          return; // Early return to prevent duplicate navigation
        } else {
          console.error('❌ Failed to submit guess:', result.err);
          setSessionError(result.err || 'Failed to submit guess');
          Alert.alert('Error', result.err || 'Failed to submit guess');
        }
      } catch (error) {
        console.error('💥 Error submitting guess:', error);
        setSessionError('Network error occurred while submitting guess');
        
        // Fallback navigation for network errors
        console.log('🔄 Using fallback navigation due to network error');
        const fallbackParams = {
          guess: finalGuess,
          actualLocation: currentPhoto!.actualLocation,
          score: score, // Use local calculated score as fallback
          timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
          difficulty: difficulty,
          photoUrl: currentPhoto!.url,
        };
        navigation.replace('GameResult', fallbackParams);
        return;
      } finally {
        setSessionLoading(false);
      }
    } else {
      console.warn('⚠️ No sessionId available for submitting guess');
      
      // Fallback navigation when no session
      console.log('🔄 Using fallback navigation due to missing session');
      const fallbackParams = {
        guess: finalGuess,
        actualLocation: currentPhoto!.actualLocation,
        score: score, // Use local calculated score as fallback
        timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
        difficulty: difficulty,
        photoUrl: currentPhoto!.url,
      };
      navigation.replace('GameResult', fallbackParams);
    }
  };
  
  const submitGuess = submitGuessRef.current;
  
  const purchaseHint = async (hint: Hint) => {
    if (!sessionId) {
      Alert.alert('エラー', 'ゲームセッションが開始されていません');
      return;
    }
    
    // Check token balance
    const costInSPOT = hint.cost / 100; // Convert from units to SPOT
    if (tokenBalance < BigInt(Math.round(hint.cost))) {
      Alert.alert(
        'SPOTトークンが不足しています',
        `このヒントの購入には ${costInSPOT} SPOT が必要です。\n現在の残高: ${Number(tokenBalance) / 100} SPOT`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Show purchase confirmation
    Alert.alert(
      'ヒントを購入しますか？',
      `${hint.title}\n費用: ${costInSPOT} SPOT\n残高: ${Number(tokenBalance) / 100} SPOT`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入',
          onPress: async () => {
            try {
              setSessionLoading(true);
              
              // Map hint type to service type
              const hintTypeMap: Record<string, ServiceHintType> = {
                'BasicRadius': { BasicRadius: null },
                'PremiumRadius': { PremiumRadius: null },
                'DirectionHint': { DirectionHint: null },
              };
              
              const result = await gameService.purchaseHint(sessionId, hintTypeMap[hint.type]);
              
              if (result.ok) {
                // Update hints with the returned data
                const updatedHints = hints.map(h => 
                  h.id === hint.id 
                    ? { 
                        ...h, 
                        unlocked: true, 
                        data: result.ok!.data,
                        content: formatHintContent(result.ok!.data)
                      }
                    : h
                );
                setHints(updatedHints);
                
                // Add to purchased hints in store
                addPurchasedHint({
                  ...hint,
                  unlocked: true,
                  data: result.ok!.data,
                  content: formatHintContent(result.ok!.data)
                });
                
                // Update token balance
                const newBalance = await gameService.getTokenBalance(principal!);
                setTokenBalance(newBalance);
                
                Alert.alert('成功', 'ヒントを購入しました！');
              } else {
                const errorMsg = result.err || 'ヒントの購入に失敗しました';
                setSessionError(errorMsg);
                Alert.alert('エラー', errorMsg);
              }
            } catch (error) {
              console.error('Failed to purchase hint:', error);
              const errorMsg = 'ネットワークエラーが発生しました';
              setSessionError(errorMsg);
              Alert.alert('エラー', errorMsg);
            } finally {
              setSessionLoading(false);
            }
          },
        },
      ]
    );
  };
  
  const formatHintContent = (data: HintContent): string => {
    if ('RadiusHint' in data && data.RadiusHint) {
      const { centerLat, centerLon, radius } = data.RadiusHint;
      return `緯度 ${centerLat.toFixed(4)}°, 経度 ${centerLon.toFixed(4)}° から半径 ${radius}m 以内`;
    } else if ('DirectionHint' in data && data.DirectionHint) {
      const directionMap: Record<string, string> = {
        'North': '北',
        'Northeast': '北東',
        'East': '東',
        'Southeast': '南東',
        'South': '南',
        'Southwest': '南西',
        'West': '西',
        'Northwest': '北西',
      };
      return `撮影方向: ${directionMap[data.DirectionHint] || data.DirectionHint}`;
    }
    return '';
  };

  const handleHomeButtonPress = () => {
    const alertMessage = hasActiveSession() 
      ? 'ホーム画面に戻ると、現在のゲームセッションは一時停止されます。後で続きをプレイできます。'
      : 'ホーム画面に戻りますか？';
      
    Alert.alert(
      'ゲームを終了しますか？',
      alertMessage,
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'セッションを破棄',
          style: 'destructive',
          onPress: async () => {
            // Stop timer before navigating
            isNavigatingAway.current = true;
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            
            // Finalize current session if active
            if (sessionId && hasActiveSession()) {
              try {
                await gameService.finalizeSession(sessionId);
                updateSessionStatus(sessionId, 'Abandoned');
              } catch (error) {
                console.warn('Failed to finalize session:', error);
              }
            }
            
            // Clear session data
            clearSessionData();
            
            // Reset navigation stack to home
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
        {
          text: hasActiveSession() ? '一時停止' : 'ホームに戻る',
          onPress: () => {
            // Stop timer before navigating
            isNavigatingAway.current = true;
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            
            // Keep session active and just navigate home
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]
    );
  };
  
  if (!currentPhoto) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3282b8" />
      </View>
    );
  }
  
  // Show loading state
  if (isLoading || isSessionLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={styles.loadingText}>
          {isSessionLoading ? 'Checking game sessions...' : 'Starting game...'}
        </Text>
        {sessionError && (
          <View style={styles.sessionErrorContainer}>
            <Ionicons name="warning" size={24} color="#ff9500" />
            <Text style={styles.sessionErrorText}>{sessionError}</Text>
          </View>
        )}
      </View>
    );
  }

  // Show error state
  if (error || sessionError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle" size={64} color="#ff4444" />
        <Text style={styles.errorText}>{error || sessionError}</Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity 
            style={[styles.retryButton, styles.primaryButton]}
            onPress={() => {
              setError(null);
              setSessionError(null);
              clearSessionData();
              // Retry initialization
              if (identity && principal) {
                setIsLoading(true);
                setSessionLoading(true);
              }
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.retryButton, styles.secondaryButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check if photo is loaded
  if (!currentPhoto) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>No photo available</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 写真を画面全体に表示 - ドラッグ可能 */}
      <View style={styles.photoContainer}>
        <Animated.Image 
          source={{ uri: currentPhoto.url }} 
          style={[
            styles.fullScreenPhoto,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: scale },
              ],
            },
          ]}
          resizeMode="contain"
          {...panResponder.panHandlers}
        />
      </View>
      
      {/* ズームリセットボタン */}
      <Animated.View
        style={[
          styles.resetButton,
          {
            opacity: scale.interpolate({
              inputRange: [1, 1.1, 5],
              outputRange: [0, 1, 1],
            }),
            transform: [{
              scale: scale.interpolate({
                inputRange: [1, 1.1, 5],
                outputRange: [0.5, 1, 1],
              }),
            }],
          },
        ]}
        pointerEvents={(scale as any)._value > 1 ? 'auto' : 'none'}
      >
        <TouchableOpacity 
          onPress={() => {
            Animated.parallel([
              Animated.spring(scale, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
              }),
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                friction: 5,
                useNativeDriver: true,
              }),
            ]).start();
            lastScale.current = 1;
            lastPan.current = { x: 0, y: 0 };
          }}
        >
          <Ionicons name="contract" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
      
      {/* UI要素のコンテナ */}
      <View style={styles.uiContainer} pointerEvents="box-none">
        <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
          {/* Region display */}
          {regionName && (
            <View style={styles.regionBadge} pointerEvents="auto">
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.regionBadgeText}>{regionName}</Text>
            </View>
          )}
          
          {/* 画面上部のステータスバー */}
          <View style={styles.gameStatusBar} pointerEvents="box-none">
            <View style={styles.statusColumn} pointerEvents="auto">
              <View style={styles.timer}>
                <Ionicons name="timer" size={20} color="#fff" />
                <Text style={styles.timerText}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </Text>
              </View>
              <View style={styles.roundInfo}>
                <Text style={styles.roundText}>Round {roundNumber}</Text>
              </View>
            </View>
            
            <View style={styles.statusItem} pointerEvents="auto">
              <View style={styles.difficulty}>
                <Text style={styles.difficultyText}>{difficulty}</Text>
                <Text style={styles.multiplierText}>
                  x{DifficultySettings[difficulty].scoreMultiplier}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusItem} pointerEvents="auto">
              <View style={styles.tokenBalance}>
                <Ionicons name="logo-bitcoin" size={16} color="#FFD700" />
                <Text style={styles.tokenText}>
                  {(Number(tokenBalance) / 100).toFixed(2)} SPOT
                </Text>
              </View>
            </View>
          </View>

          {/* 方位表示 */}
          {showCompass && (
            <View style={styles.compassBarContainer} pointerEvents="none">
              <CompassBar azimuth={currentPhoto.azimuth} />
            </View>
          )}
        </SafeAreaView>
        
        {/* 画面下部のツールバー */}
        <View style={styles.bottomToolbar} pointerEvents="box-none">
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowCompass(!showCompass)}
            pointerEvents="auto"
          >
            <Ionicons name="compass" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowAnalysis(true)}
            pointerEvents="auto"
          >
            <Ionicons name="analytics" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowHintModal(true)}
            pointerEvents="auto"
          >
            <Ionicons name="bulb" size={24} color="#FFD700" />
            {hints.filter(h => h.unlocked).length > 0 && (
              <View style={styles.hintBadge}>
                <Text style={styles.hintBadgeText}>
                  {hints.filter(h => h.unlocked).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolButton}
            onPress={handleHomeButtonPress}
            pointerEvents="auto"
          >
            <Ionicons name="home" size={24} color="#fff" />
          </TouchableOpacity>

          {/* 写真情報 */}
          <View style={styles.photoInfoInToolbar} pointerEvents="none">
            <Text style={styles.uploadTime}>
              {new Date(currentPhoto.timestamp).toLocaleDateString()}
            </Text>
            <Text style={styles.uploader}>
              by {currentPhoto.uploader.length > 10 
                ? `${currentPhoto.uploader.slice(0, 5)}...${currentPhoto.uploader.slice(-5)}`
                : currentPhoto.uploader
              }
            </Text>
            {/* 平均得点表示 */}
            {photoStats && photoStats.playCount > 0 && (
              <View style={styles.photoStats}>
                <Ionicons name="analytics" size={12} color="#FFD700" />
                <Text style={styles.averageScore}>
                  平均: {Math.round(photoStats.averageScore)}pts
                </Text>
                <Text style={styles.playCount}>
                  ({Number(photoStats.playCount)}回)
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* 地図を開くボタン - コンパスの下に配置 */}
        <TouchableOpacity 
          style={[styles.mapButton, currentGuess && styles.mapButtonActive]}
          onPress={() => {
            navigation.navigate('GuessMap', {
              photoUrl: currentPhoto.url,
              difficulty: difficulty,
              timeLeft: timeLeft,
              initialGuess: currentGuess,
              confidenceRadius: confidenceRadius,
            });
          }}
          pointerEvents="auto"
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={currentGuess ? ['#4CAF50', '#45A049'] : ['#FF6B6B', '#FF5252']}
            style={styles.mapButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="map" size={32} color="#fff" />
            {!currentGuess && (
              <Text style={styles.mapButtonText}>推測</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      {/* ヒントモーダル */}
      <HintModal
        visible={showHintModal}
        hints={hints}
        onPurchase={purchaseHint}
        onClose={() => setShowHintModal(false)}
        costMultiplier={DifficultySettings[difficulty].hintCostMultiplier}
      />
      
      {/* 写真分析モーダル */}
      <PhotoAnalysisModal
        visible={showAnalysis}
        photo={currentPhoto}
        onClose={() => setShowAnalysis(false)}
      />
      
    </View>
  );
}

// コンパスバー表示コンパーネント
const CompassBar = ({ azimuth }: { azimuth: number }) => {
  return (
    <View style={styles.compassBar}>
      {/* 中央のインジケーター - 写真の方角のみ表示 */}
      <View style={styles.compassCenter}>
        <View style={styles.compassCenterLine} />
        <Text style={styles.compassDegreeText}>{Math.round(azimuth)}°</Text>
        <Text style={styles.compassDirectionText}>
          {getDirectionLabel(azimuth)}
        </Text>
      </View>
    </View>
  );
};

// 方角を文字で表示するヘルパー関数
const getDirectionLabel = (angle: number): string => {
  const normalizedAngle = ((angle % 360) + 360) % 360;
  
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'N';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'NE';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'E';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'SE';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'S';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'SW';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'W';
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'NW';
  
  return 'N';
};


// ヒントモーダル
const HintModal = ({ visible, hints, onPurchase, onClose, costMultiplier }) => {
  const { tokenBalance } = useGameStore();
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView style={styles.modalContainer} intensity={100}>
        <View style={styles.hintModal}>
          <Text style={styles.modalTitle}>ヒントショップ</Text>
          
          <View style={styles.modalTokenBalance}>
            <Ionicons name="logo-bitcoin" size={20} color="#FFD700" />
            <Text style={styles.modalTokenText}>
              残高: {(Number(tokenBalance) / 100).toFixed(2)} SPOT
            </Text>
          </View>
          
          <ScrollView style={styles.hintList}>
            {hints.map((hint) => (
              <TouchableOpacity
                key={hint.id}
                style={[styles.hintItem, hint.unlocked && styles.hintUnlocked]}
                onPress={() => !hint.unlocked && onPurchase(hint)}
                disabled={hint.unlocked}
              >
                <View style={styles.hintHeader}>
                  <Text style={styles.hintTitle}>{hint.title}</Text>
                  <Text style={[styles.hintCost, 
                    tokenBalance < BigInt(Math.round(hint.cost)) && !hint.unlocked && styles.hintCostInsufficient
                  ]}>
                    {hint.unlocked ? '購入済み' : `${(hint.cost / 100).toFixed(2)} SPOT`}
                  </Text>
                </View>
                {hint.unlocked && (
                  <Text style={styles.hintContent}>{hint.content}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

// 写真分析モーダル
const PhotoAnalysisModal = ({ visible, photo, onClose }) => {
  const [analysis] = useState({
    vegetation: '温帯林',
    architecture: '現代的な都市建築',
    shadows: '正午頃、南からの太陽光',
    terrain: '海岸地域',
    signage: 'ラテン文字を検出',
    weather: '晴天',
  });
  
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView style={styles.modalContainer} intensity={100}>
        <View style={styles.analysisModal}>
          <Text style={styles.modalTitle}>AI写真分析</Text>
          
          <ScrollView style={styles.analysisList}>
            {Object.entries(analysis).map(([key, value]) => (
              <View key={key} style={styles.analysisItem}>
                <Ionicons 
                  name={getAnalysisIcon(key) as any} 
                  size={24} 
                  color="#3282b8" 
                />
                <View style={styles.analysisContent}>
                  <Text style={styles.analysisLabel}>{getAnalysisLabel(key)}</Text>
                  <Text style={styles.analysisValue}>{value}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          
          <TouchableOpacity style={styles.deepAnalysisButton}>
            <Text style={styles.deepAnalysisText}>詳細分析 (50 SPOT)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
};

// ヘルパー関数

const getAnalysisIcon = (key: string): string => {
  const icons = {
    vegetation: 'leaf',
    architecture: 'business',
    shadows: 'sunny',
    terrain: 'map',
    signage: 'text',
    weather: 'cloud',
  };
  return icons[key] || 'help';
};

const getAnalysisLabel = (key: string): string => {
  const labels = {
    vegetation: '植生',
    architecture: '建築様式',
    shadows: '影の分析',
    terrain: '地形',
    signage: '標識・文字',
    weather: '天候',
  };
  return labels[key] || key;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  photoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  fullScreenPhoto: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  uiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  photoInfoInToolbar: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 60,
    minWidth: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTime: {
    color: '#fff',
    fontSize: 18,
    opacity: 0.8,
    textAlign: 'center',
  },
  uploader: {
    color: '#fff',
    fontSize: 20,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  compassBarContainer: {
    marginTop: 10,
    height: 60,
  },
  compassBar: {
    height: 60,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassCenterLine: {
    width: 2,
    height: 30,
    backgroundColor: '#FFD700',
    marginBottom: 4,
  },
  compassDegreeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
  },
  compassDirectionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoToolbar: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    gap: 10,
  },
  toolButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFD700',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  difficulty: {
    alignItems: 'center',
  },
  difficultyText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  multiplierText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  roundInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  roundText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tokenBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tokenText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalTokenBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalTokenText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hintList: {
    maxHeight: 400,
  },
  hintItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  hintUnlocked: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  hintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  hintTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hintCost: {
    color: '#FFD700',
    fontSize: 14,
  },
  hintCostInsufficient: {
    color: '#FF6B6B',
  },
  hintContent: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 10,
  },
  closeButton: {
    backgroundColor: '#3282b8',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analysisModal: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
  },
  analysisList: {
    maxHeight: 400,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 15,
  },
  analysisContent: {
    flex: 1,
  },
  analysisLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  analysisValue: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  deepAnalysisButton: {
    backgroundColor: '#FFD700',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  deepAnalysisText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 新しいレイアウト用のスタイル
  topBar: {
    paddingHorizontal: 15,
    paddingBottom: 10,
    marginTop: -50,
  },
  gameStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 10,
  },
  statusItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusColumn: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  bottomToolbar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetButton: {
    position: 'absolute',
    top: 260,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  mapButton: {
    position: 'absolute',
    top: 180,
    right: 15,
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mapButtonActive: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  mapButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  
  // Loading and error states
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#3282b8',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Session error handling styles
  sessionErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9500',
  },
  sessionErrorText: {
    color: '#ff9500',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorButtons: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3282b8',
  },
  secondaryButton: {
    backgroundColor: '#666',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
    marginHorizontal: 15,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  regionBadgeText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  photoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  averageScore: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playCount: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
  },
});