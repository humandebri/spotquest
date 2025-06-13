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
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';
import { useAuth } from '../hooks/useAuth';
import { gameService, HintType as ServiceHintType, HintData, HintContent } from '../services/game';

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
  const { gameMode = 'normal', difficulty = Difficulty.NORMAL } = route.params || {};
  
  // Game store
  const { 
    currentPhoto, 
    currentGuess,
    confidenceRadius,
    sessionId,
    tokenBalance,
    purchasedHints,
    roundNumber,
    setCurrentPhoto,
    setGuess: setGameGuess,
    setTimeLeft: setGameTimeLeft,
    setSessionId,
    setTokenBalance,
    setRoundNumber,
    addPurchasedHint,
  } = useGameStore();
  
  // Auth store
  const { principal, identity } = useAuth();
  
  // ゲーム状態
  const [azimuthGuess, setAzimuthGuess] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DifficultySettings[difficulty].timeLimit);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize gameService with identity
  useEffect(() => {
    if (identity) {
      gameService.init(identity).catch(console.error);
    }
  }, [identity]);
  
  // Initialize session and photo
  useEffect(() => {
    const initializeGame = async () => {
      // Wait for gameService to be initialized
      if (!identity) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        
        // Create session if not exists or get next round for existing session
        if (!sessionId) {
          const result = await gameService.createSession();
          
          if (result.err) {
            throw new Error(result.err);
          }
          
          if (result.ok) {
            setSessionId(result.ok);
            
            // Reset round number for new session
            setRoundNumber(1);
            
            // Get first round
            const roundResult = await gameService.getNextRound(result.ok);
            
            if (roundResult.err) {
              throw new Error(roundResult.err);
            }
            
            if (roundResult.ok) {
              // TODO: Set actual photo from round data
              setCurrentPhoto({
                id: roundResult.ok.photoId.toString(),
                url: 'https://picsum.photos/800/600', // TODO: Get from photo canister
                actualLocation: { latitude: 35.6762, longitude: 139.6503 }, // TODO: Get from round
                azimuth: 45,
                timestamp: Date.now(),
                uploader: '2vxsx-fae',
                difficulty,
              });
            }
          }
        } else {
          // Existing session - get next round
          const roundResult = await gameService.getNextRound(sessionId);
          console.log('Get round result:', roundResult);
          
          if (roundResult.err) {
            throw new Error(roundResult.err);
          }
          
          if (roundResult.ok) {
            // TODO: Set actual photo from round data
            setCurrentPhoto({
              id: roundResult.ok.photoId.toString(),
              url: 'https://picsum.photos/800/600?' + Date.now(), // TODO: Get from photo canister, add timestamp to force new image
              actualLocation: { latitude: 35.6762, longitude: 139.6503 }, // TODO: Get from round
              azimuth: 45,
              timestamp: Date.now(),
              uploader: '2vxsx-fae',
              difficulty,
            });
          }
        }
        
        // Update token balance
        if (principal) {
          const balance = await gameService.getTokenBalance(principal);
          setTokenBalance(balance);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize game:', err);
        setError(err instanceof Error ? err.message : 'Failed to start game');
        setIsLoading(false);
        
        // Show error alert with more specific message
        const errorMessage = err instanceof Error && err.message.includes('certificate') 
          ? 'Certificate verification failed. This is a known issue with dev mode on mainnet. Please try using Internet Identity for full functionality.'
          : (err instanceof Error ? err.message : 'Failed to start game');
          
        Alert.alert(
          'Game Error',
          errorMessage,
          [
            { text: 'Go Back', onPress: () => navigation.goBack() }
          ]
        );
      }
    };
    
    initializeGame();
  }, [sessionId, principal, identity]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up timer when component unmounts
      isNavigatingAway.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  
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
          x: pan.x._value,
          y: pan.y._value,
        };
        lastScale.current = scale._value;
        
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
          const currentScale = scale._value;
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
        if (scale._value < 1) {
          Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
        
        // Center the image if panned too far
        const currentScale = scale._value;
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
        
        const currentX = pan.x._value;
        const currentY = pan.y._value;
        
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
    // Don't run timer if navigating away or time is already up
    if (isNavigatingAway.current || timeLeft <= 0) {
      return;
    }
    
    // Handle timeout only if still on this screen
    if (timeLeft === 0 && !isNavigatingAway.current) {
      handleTimeout();
      return;
    }
    
    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeLeft]);
  
  const handleTimeout = () => {
    Alert.alert('時間切れ！', 'ランダムな場所で推測を送信します。', [
      { text: 'OK', onPress: () => submitGuess(true) }
    ]);
  };
  
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
  
  const submitGuess = async (isTimeout = false) => {
    if (!currentGuess && !isTimeout) {
      Alert.alert('エラー', '地図をタップして場所を推測してください');
      return;
    }
    
    const finalGuess = currentGuess || {
      latitude: (Math.random() - 0.5) * 180,
      longitude: (Math.random() - 0.5) * 360,
    };
    
    // Stop timer before navigating
    isNavigatingAway.current = true;
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
        const result = await gameService.submitGuess(
          sessionId,
          finalGuess.latitude,
          finalGuess.longitude,
          azimuthGuess,
          confidenceRadius
        );
        
        if (result.ok) {
          // Guess submitted successfully
        } else {
          console.error('Failed to submit guess:', result.err);
          Alert.alert('Error', result.err || 'Failed to submit guess');
        }
      } catch (error) {
        console.error('Error submitting guess:', error);
      }
    }
    
    // Navigate to result screen
    navigation.navigate('GameResult', {
      guess: finalGuess,
      actualLocation: currentPhoto!.actualLocation,
      score: score,
      timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
      difficulty: difficulty,
      photoUrl: currentPhoto!.url,
    });
  };
  
  const purchaseHint = async (hint: Hint) => {
    if (!sessionId) {
      Alert.alert('エラー', 'ゲームセッションが開始されていません');
      return;
    }
    
    // Check token balance
    const costInSPOT = hint.cost / 100; // Convert from units to SPOT
    if (tokenBalance < BigInt(hint.cost)) {
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
                Alert.alert('エラー', result.err || 'ヒントの購入に失敗しました');
              }
            } catch (error) {
              console.error('Failed to purchase hint:', error);
              Alert.alert('エラー', 'ヒントの購入に失敗しました');
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
    Alert.alert(
      'ゲームを終了しますか？',
      'ホーム画面に戻ると、現在のゲームの進行状況が失われます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: 'ホームに戻る',
          style: 'destructive',
          onPress: () => {
            // Stop timer before navigating
            isNavigatingAway.current = true;
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            
            // Reset navigation stack to home
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
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={styles.loadingText}>Starting game...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle" size={64} color="#ff4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        pointerEvents={scale._value > 1 ? 'auto' : 'none'}
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
                    tokenBalance < BigInt(hint.cost) && !hint.unlocked && styles.hintCostInsufficient
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
});