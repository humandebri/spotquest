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
  type: 'region' | 'climate' | 'landmark' | 'culture' | 'vegetation' | 'timezone';
  cost: number;
  title: string;
  content: string;
  unlocked: boolean;
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
    setCurrentPhoto,
    setGuess: setGameGuess,
    setTimeLeft: setGameTimeLeft,
  } = useGameStore();
  
  // ゲーム状態
  const [azimuthGuess, setAzimuthGuess] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DifficultySettings[difficulty].timeLimit);
  
  // Initialize photo if not set
  useEffect(() => {
    if (!currentPhoto) {
      setCurrentPhoto({
        id: '1',
        url: 'https://picsum.photos/800/600',
        actualLocation: { latitude: 35.6762, longitude: 139.6503 }, // 東京
        azimuth: 45,
        timestamp: Date.now(),
        uploader: '2vxsx-fae',
        difficulty,
      });
    }
  }, []);
  
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
    { id: '1', type: 'region', cost: 5, title: '地域', content: '', unlocked: false },
    { id: '2', type: 'climate', cost: 10, title: '気候', content: '', unlocked: false },
    { id: '3', type: 'landmark', cost: 15, title: 'ランドマーク', content: '', unlocked: false },
    { id: '4', type: 'culture', cost: 20, title: '文化', content: '', unlocked: false },
    { id: '5', type: 'vegetation', cost: 25, title: '植生', content: '', unlocked: false },
    { id: '6', type: 'timezone', cost: 30, title: 'タイムゾーン', content: '', unlocked: false },
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
    
    console.log('Distance calculation:', {
      guess: finalGuess,
      actual: currentPhoto!.actualLocation,
      distanceMeters: distance,
      distanceKm: distance / 1000,
      score: score,
    });
    
    // TODO: ICPに推測を送信
    navigation.navigate('GameResult', {
      guess: finalGuess,
      actualLocation: currentPhoto!.actualLocation,
      score: score,
      timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
      difficulty: difficulty,
      photoUrl: currentPhoto!.url,
    });
  };
  
  const purchaseHint = (hint: Hint) => {
    // TODO: SPOTトークンを消費
    const updatedHints = hints.map(h => 
      h.id === hint.id 
        ? { ...h, unlocked: true, content: generateHintContent(h.type) }
        : h
    );
    setHints(updatedHints);
  };
  
  const generateHintContent = (type: string): string => {
    // 実際のゲームではサーバーから取得
    const hintContents = {
      region: 'この写真は東アジアで撮影されました',
      climate: '温帯気候の地域です',
      landmark: '近くに有名な電波塔があります',
      culture: '主要言語は日本語です',
      vegetation: '桜の木が多い地域です',
      timezone: 'UTC+9のタイムゾーンです',
    };
    return hintContents[type] || '';
  };
  
  if (!currentPhoto) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3282b8" />
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
        {/* 画面上部のステータスバー */}
        <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
          <View style={styles.gameStatusBar} pointerEvents="box-none">
            <View style={styles.statusItem} pointerEvents="auto">
              <View style={styles.timer}>
                <Ionicons name="timer" size={20} color="#fff" />
                <Text style={styles.timerText}>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </Text>
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
          </View>
        </SafeAreaView>
        
        {/* 方位表示 */}
        {showCompass && (
          <View style={styles.compassContainer} pointerEvents="auto">
            <CompassIndicator azimuth={currentPhoto.azimuth} />
          </View>
        )}
        
        {/* 写真情報オーバーレイ */}
        <View style={styles.photoInfoContainer} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.photoOverlay}
          >
            <View style={styles.photoInfo}>
              <Text style={styles.uploadTime}>
                {new Date(currentPhoto.timestamp).toLocaleDateString()}
              </Text>
              <Text style={styles.uploader}>
                by {currentPhoto.uploader.slice(0, 8)}...
              </Text>
            </View>
          </LinearGradient>
        </View>
        
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

// コンパス表示コンポーネント
const CompassIndicator = ({ azimuth }: { azimuth: number }) => {
  const rotation = new Animated.Value(0);
  
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: azimuth,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [azimuth]);
  
  return (
    <View style={styles.compass}>
      <Animated.View
        style={[
          styles.compassNeedle,
          {
            transform: [{ rotate: `${azimuth}deg` }],
          },
        ]}
      >
        <View style={styles.compassNorth} />
        <View style={styles.compassSouth} />
      </Animated.View>
      <Text style={styles.compassText}>{Math.round(azimuth)}°</Text>
    </View>
  );
};


// ヒントモーダル
const HintModal = ({ visible, hints, onPurchase, onClose, costMultiplier }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView style={styles.modalContainer} intensity={100}>
        <View style={styles.hintModal}>
          <Text style={styles.modalTitle}>ヒントショップ</Text>
          
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
                  <Text style={styles.hintCost}>
                    {hint.unlocked ? '購入済み' : `${Math.round(hint.cost * costMultiplier)} SPOT`}
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
                  name={getAnalysisIcon(key)} 
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
  photoInfoContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
  },
  photoOverlay: {
    height: 80,
    justifyContent: 'flex-end',
    padding: 15,
  },
  photoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  uploadTime: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  uploader: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  compassContainer: {
    position: 'absolute',
    top: 100,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compass: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassNeedle: {
    position: 'absolute',
    width: 4,
    height: 50,
  },
  compassNorth: {
    width: 4,
    height: 25,
    backgroundColor: '#FF0000',
  },
  compassSouth: {
    width: 4,
    height: 25,
    backgroundColor: '#FFFFFF',
  },
  compassText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 5,
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
    marginBottom: 20,
    textAlign: 'center',
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
  
});