import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


export default function GuessMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GuessMap'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GuessMap'>>();
  const { setGuess: setGameGuess, currentPhoto } = useGameStore();
  
  const { 
    photoUrl, 
    difficulty, 
    timeLeft, 
    initialGuess,
    confidenceRadius: initialRadius = 1000,
  } = route.params || {};

  const [guess, setGuess] = useState<{ latitude: number; longitude: number } | null>(initialGuess || null);
  const [confidenceRadius, setConfidenceRadius] = useState(initialRadius);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain'>('standard');

  // 方位線の終点を計算
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

  const handleSubmit = () => {
    if (guess && currentPhoto) {
      // Save guess to store
      setGameGuess(guess, confidenceRadius);
      
      // Navigate to GameResult with the guess data
      navigation.navigate('GameResult', {
        guess: guess,
        actualLocation: currentPhoto.actualLocation,
        score: 85, // TODO: Calculate actual score
        timeUsed: 180 - timeLeft,
        difficulty: difficulty,
        photoUrl: photoUrl,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* 上部の写真サムネイル */}
      <TouchableOpacity 
        style={styles.photoHeader}
        onPress={() => navigation.goBack()}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: photoUrl }} 
          style={styles.photoThumbnail}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.photoOverlay}
        >
          <View style={styles.headerInfo}>
            <View style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text style={styles.backText}>写真に戻る</Text>
            </View>
            <View style={styles.timer}>
              <Ionicons name="timer" size={20} color="#fff" />
              <Text style={styles.timerText}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* 地図 */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={{
          latitude: guess?.latitude || 0,
          longitude: guess?.longitude || 0,
          latitudeDelta: 10,
          longitudeDelta: 10,
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
          </>
        )}
      </MapView>

      {/* コントロールパネル */}
      <View style={styles.controlPanel}>
        {/* 地図タイプ選択 */}
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

        {/* 確信度スライダー */}
        <View style={styles.confidenceControl}>
          <Text style={styles.controlLabel}>確信度: {Math.round(confidenceRadius)}m</Text>
          <Slider
            style={styles.slider}
            minimumValue={100}
            maximumValue={5000}
            value={confidenceRadius}
            onValueChange={setConfidenceRadius}
            minimumTrackTintColor="#FF0000"
            maximumTrackTintColor="#CCCCCC"
          />
        </View>

        {/* 送信ボタン */}
        <TouchableOpacity
          style={[styles.submitButton, !guess && styles.submitButtonDisabled]}
          onPress={handleSubmit}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  photoHeader: {
    height: SCREEN_HEIGHT * 0.33,
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-end',
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  guessMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPanel: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    gap: 15,
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
    marginTop: 5,
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
  submitButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 5,
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
});