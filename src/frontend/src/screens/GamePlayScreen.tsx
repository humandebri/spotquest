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
  PanResponder,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

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
  
  // ゲーム状態
  const [currentPhoto, setCurrentPhoto] = useState<GamePhoto>({
    id: '1',
    url: 'https://picsum.photos/800/600',
    actualLocation: { latitude: 35.6762, longitude: 139.6503 }, // 東京
    azimuth: 45,
    timestamp: Date.now(),
    uploader: '2vxsx-fae',
    difficulty,
  });
  
  const [guess, setGuess] = useState<{ latitude: number; longitude: number } | null>(null);
  const [azimuthGuess, setAzimuthGuess] = useState(0);
  const [confidenceRadius, setConfidenceRadius] = useState(1000); // meters
  const [timeLeft, setTimeLeft] = useState(DifficultySettings[difficulty].timeLimit);
  const [hints, setHints] = useState<Hint[]>([
    { id: '1', type: 'region', cost: 5, title: '地域', content: '', unlocked: false },
    { id: '2', type: 'climate', cost: 10, title: '気候', content: '', unlocked: false },
    { id: '3', type: 'landmark', cost: 15, title: 'ランドマーク', content: '', unlocked: false },
    { id: '4', type: 'culture', cost: 20, title: '文化', content: '', unlocked: false },
    { id: '5', type: 'vegetation', cost: 25, title: '植生', content: '', unlocked: false },
    { id: '6', type: 'timezone', cost: 30, title: 'タイムゾーン', content: '', unlocked: false },
  ]);
  
  // UI状態
  const [showPhotoZoom, setShowPhotoZoom] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');
  const [showCompass, setShowCompass] = useState(true);
  const [photoZoom] = useState(new Animated.Value(1));
  
  // タイマー
  useEffect(() => {
    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }
    
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeLeft]);
  
  const handleTimeout = () => {
    Alert.alert('時間切れ！', 'ランダムな場所で推測を送信します。', [
      { text: 'OK', onPress: () => submitGuess(true) }
    ]);
  };
  
  const calculatePotentialScore = () => {
    if (!guess) return { min: 0, max: 100 };
    
    const difficultyMultiplier = DifficultySettings[difficulty].scoreMultiplier;
    const baseScore = 100 - (confidenceRadius / 100);
    
    return {
      min: Math.max(0, Math.floor((baseScore - 20) * difficultyMultiplier)),
      max: Math.min(100, Math.floor((baseScore + 10) * difficultyMultiplier)),
    };
  };
  
  const submitGuess = async (isTimeout = false) => {
    if (!guess && !isTimeout) {
      Alert.alert('エラー', '地図をタップして場所を推測してください');
      return;
    }
    
    const finalGuess = guess || {
      latitude: (Math.random() - 0.5) * 180,
      longitude: (Math.random() - 0.5) * 360,
    };
    
    // TODO: ICPに推測を送信
    navigation.navigate('GameResult', {
      guess: finalGuess,
      actualLocation: currentPhoto.actualLocation,
      score: calculatePotentialScore().max,
      timeUsed: DifficultySettings[difficulty].timeLimit - timeLeft,
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
  
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* 写真表示エリア */}
      <View style={styles.photoSection}>
        <TouchableOpacity 
          activeOpacity={0.95}
          onPress={() => setShowPhotoZoom(true)}
        >
          <Image 
            source={{ uri: currentPhoto.url }} 
            style={styles.photo}
            resizeMode="cover"
          />
          
          {/* 写真オーバーレイ情報 */}
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
          
          {/* 方位表示 */}
          {showCompass && (
            <View style={styles.compassContainer}>
              <CompassIndicator azimuth={currentPhoto.azimuth} />
            </View>
          )}
        </TouchableOpacity>
        
        {/* ツールバー */}
        <View style={styles.photoToolbar}>
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowCompass(!showCompass)}
          >
            <Ionicons name="compass" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowAnalysis(true)}
          >
            <Ionicons name="analytics" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowHintModal(true)}
          >
            <Ionicons name="bulb" size={24} color="#FFD700" />
            <Text style={styles.hintCount}>
              {hints.filter(h => h.unlocked).length}/{hints.length}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* タイマーと難易度表示 */}
      <View style={styles.gameStatus}>
        <View style={styles.timer}>
          <Ionicons name="timer" size={20} color="#fff" />
          <Text style={styles.timerText}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        
        <View style={styles.difficulty}>
          <Text style={styles.difficultyText}>{difficulty}</Text>
          <Text style={styles.multiplierText}>
            x{DifficultySettings[difficulty].scoreMultiplier}
          </Text>
        </View>
        
        <View style={styles.scorePreview}>
          <Text style={styles.scoreLabel}>予想スコア</Text>
          <Text style={styles.scoreRange}>
            {calculatePotentialScore().min} - {calculatePotentialScore().max}
          </Text>
        </View>
      </View>
      
      {/* 地図エリア */}
      <View style={styles.mapSection}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          mapType={mapType}
          initialRegion={{
            latitude: 0,
            longitude: 0,
            latitudeDelta: DifficultySettings[difficulty].startingZoom,
            longitudeDelta: DifficultySettings[difficulty].startingZoom,
          }}
          onPress={(e) => setGuess(e.nativeEvent.coordinate)}
        >
          {guess && (
            <>
              {/* 推測マーカー */}
              <Marker
                coordinate={guess}
                draggable
                onDragEnd={(e) => setGuess(e.nativeEvent.coordinate)}
              >
                <View style={styles.guessMarker}>
                  <Ionicons name="location" size={40} color="#FF0000" />
                </View>
              </Marker>
              
              {/* 確信度円 */}
              <Circle
                center={guess}
                radius={confidenceRadius}
                fillColor="rgba(255, 0, 0, 0.1)"
                strokeColor="rgba(255, 0, 0, 0.5)"
                strokeWidth={2}
              />
              
              {/* 方位線 */}
              <Polyline
                coordinates={[
                  guess,
                  computeDestinationPoint(guess, azimuthGuess, 1000)
                ]}
                strokeColor="#0000FF"
                strokeWidth={3}
              />
            </>
          )}
        </MapView>
        
        {/* 地図コントロール */}
        <View style={styles.mapControls}>
          <View style={styles.mapTypeSelector}>
            <TouchableOpacity
              style={[styles.mapTypeButton, mapType === 'standard' && styles.activeMapType]}
              onPress={() => setMapType('standard')}
            >
              <Text style={styles.mapTypeText}>標準</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapTypeButton, mapType === 'satellite' && styles.activeMapType]}
              onPress={() => setMapType('satellite')}
            >
              <Text style={styles.mapTypeText}>衛星</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapTypeButton, mapType === 'terrain' && styles.activeMapType]}
              onPress={() => setMapType('terrain')}
            >
              <Text style={styles.mapTypeText}>地形</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.confidenceControl}>
            <Text style={styles.controlLabel}>確信度: {Math.round(confidenceRadius)}m</Text>
            <Slider
              style={styles.slider}
              minimumValue={100}
              maximumValue={DifficultySettings[difficulty].maxConfidenceRadius}
              value={confidenceRadius}
              onValueChange={setConfidenceRadius}
              minimumTrackTintColor="#FF0000"
              maximumTrackTintColor="#CCCCCC"
            />
          </View>
          
          <View style={styles.azimuthControl}>
            <Text style={styles.controlLabel}>方位: {Math.round(azimuthGuess)}°</Text>
            <AzimuthWheel 
              value={azimuthGuess} 
              onChange={setAzimuthGuess}
            />
          </View>
        </View>
      </View>
      
      {/* 推測送信ボタン */}
      <TouchableOpacity
        style={[styles.submitButton, !guess && styles.submitButtonDisabled]}
        onPress={() => submitGuess()}
        disabled={!guess}
      >
        <LinearGradient
          colors={guess ? ['#4CAF50', '#45A049'] : ['#CCCCCC', '#AAAAAA']}
          style={styles.submitGradient}
        >
          <Text style={styles.submitText}>
            {guess ? '推測を送信' : '地図をタップして推測'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
      
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
      
      {/* ズーム写真モーダル */}
      <PhotoZoomModal
        visible={showPhotoZoom}
        photo={currentPhoto}
        onClose={() => setShowPhotoZoom(false)}
      />
    </SafeAreaView>
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

// 方位角ホイールコンポーネント
const AzimuthWheel = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const angle = Math.atan2(gestureState.dy, gestureState.dx) * (180 / Math.PI);
        onChange((angle + 360) % 360);
      },
    })
  ).current;
  
  return (
    <View style={styles.azimuthWheel} {...panResponder.panHandlers}>
      <View
        style={[
          styles.azimuthIndicator,
          { transform: [{ rotate: `${value}deg` }] },
        ]}
      />
      <Text style={styles.azimuthValue}>{Math.round(value)}°</Text>
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

// 写真ズームモーダル
const PhotoZoomModal = ({ visible, photo, onClose }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: translateX, dy: translateY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.zoomContainer}>
        <TouchableOpacity style={styles.zoomClose} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        
        <Animated.Image
          {...panResponder.panHandlers}
          source={{ uri: photo.url }}
          style={[
            styles.zoomImage,
            {
              transform: [
                { scale },
                { translateX },
                { translateY },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
};

// ヘルパー関数
const computeDestinationPoint = (start: { latitude: number; longitude: number }, bearing: number, distance: number) => {
  const R = 6371000; // 地球の半径（メートル）
  const φ1 = start.latitude * (Math.PI / 180);
  const λ1 = start.longitude * (Math.PI / 180);
  const θ = bearing * (Math.PI / 180);
  
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distance / R) +
    Math.cos(φ1) * Math.sin(distance / R) * Math.cos(θ)
  );
  
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(distance / R) * Math.cos(φ1),
    Math.cos(distance / R) - Math.sin(φ1) * Math.sin(φ2)
  );
  
  return {
    latitude: φ2 * (180 / Math.PI),
    longitude: λ2 * (180 / Math.PI),
  };
};

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
    backgroundColor: '#0f1117',
  },
  photoSection: {
    height: SCREEN_HEIGHT * 0.35,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    padding: 15,
  },
  photoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    top: 15,
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
    padding: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hintCount: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gameStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#1a1a2e',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
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
  scorePreview: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  scoreRange: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapSection: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  guessMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    padding: 15,
    gap: 10,
  },
  mapTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  mapTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activeMapType: {
    backgroundColor: '#3282b8',
  },
  mapTypeText: {
    color: '#fff',
    fontSize: 12,
  },
  confidenceControl: {
    marginTop: 10,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  azimuthControl: {
    alignItems: 'center',
  },
  azimuthWheel: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  azimuthIndicator: {
    position: 'absolute',
    width: 2,
    height: 30,
    backgroundColor: '#FF0000',
    bottom: 40,
  },
  azimuthValue: {
    color: '#fff',
    fontSize: 12,
  },
  submitButton: {
    margin: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    padding: 15,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
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
  zoomContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  zoomImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});