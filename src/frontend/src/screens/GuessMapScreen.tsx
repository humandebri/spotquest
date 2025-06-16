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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';
import { useAuth } from '../hooks/useAuth';
import { gameService } from '../services/game';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


export default function GuessMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GuessMap'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GuessMap'>>();
  const { setGuess: setGameGuess, currentPhoto, resetGame, sessionId, confidenceRadius } = useGameStore();
  const { identity } = useAuth();
  
  const { 
    photoUrl, 
    difficulty, 
    timeLeft: initialTimeLeft, 
    initialGuess,
  } = route.params || {};

  const [guess, setGuess] = useState<{ latitude: number; longitude: number } | null>(initialGuess || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft || 180);

  // Timer effect
  useEffect(() => {
    // Don't run timer if already at 0 or submitting
    if (timeLeft <= 0 || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitting]);

  // Handle timeout
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitting) {
      // Time's up - auto submit with current guess or random location
      if (guess) {
        handleSubmit();
      } else {
        // Set a random guess and submit
        const randomGuess = {
          latitude: Math.random() * 180 - 90,
          longitude: Math.random() * 360 - 180,
        };
        setGuess(randomGuess);
        // handleSubmit will be called after guess state updates
        setTimeout(() => handleSubmit(), 100);
      }
    }
  }, [timeLeft]);

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

  const handleSubmit = async () => {
    if (!guess) {
      console.warn('🗺️ No guess provided');
      return;
    }

    if (!sessionId) {
      console.error('🗺️ No sessionId available');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('🗺️ Submitting guess to backend:', {
        sessionId,
        guess,
        confidenceRadius: confidenceRadius || 1000
      });

      // Initialize game service if needed
      if (identity) {
        await gameService.init(identity);
      }

      // Submit guess to backend - this is the key fix!
      const result = await gameService.submitGuess(
        sessionId,
        guess.latitude,
        guess.longitude,
        null, // azimuth guess
        confidenceRadius || 1000
      );

      console.log('🗺️ Backend submitGuess result:', result);

      if (result.ok) {
        // Backend submission successful - use backend data
        const backendResult = result.ok;
        
        console.log('🗺️ Backend returned result:', backendResult);
        
        // Save guess to store
        setGameGuess(guess, confidenceRadius || 1000);
        
        // Navigate to GameResult with backend data
        const resultParams = {
          guess: {
            latitude: guess.latitude,
            longitude: guess.longitude,
          },
          actualLocation: {
            latitude: backendResult.actualLocation.lat,
            longitude: backendResult.actualLocation.lon,
          },
          score: backendResult.displayScore, // Use backend score
          timeUsed: Math.max(0, 180 - (timeLeft || 180)),
          difficulty: difficulty || 'NORMAL',
          photoUrl: photoUrl || 'https://picsum.photos/800/600',
        };

        console.log('🗺️ Navigating to GameResult with backend data:', {
          ...resultParams,
          photoUrl: resultParams.photoUrl ? '[BASE64_IMAGE_DATA]' : undefined
        });
        
        // Reset the guess in the store
        setGameGuess(null, confidenceRadius || 1000);
        
        // Navigate to GameResult
        navigation.replace('GameResult', resultParams);
      } else {
        console.error('🗺️ Backend error:', result.err);
        
        // Fallback to local calculation for now
        console.log('🗺️ Falling back to local calculation');
        const actualLocation = currentPhoto?.actualLocation || { latitude: 35.6762, longitude: 139.6503 };
        const distance = calculateDistance(
          guess.latitude,
          guess.longitude,
          actualLocation.latitude,
          actualLocation.longitude
        );
        const score = calculateScore(distance);
        
        const resultParams = {
          guess: {
            latitude: guess.latitude,
            longitude: guess.longitude,
          },
          actualLocation: {
            latitude: actualLocation.latitude,
            longitude: actualLocation.longitude,
          },
          score: score,
          timeUsed: Math.max(0, 180 - (timeLeft || 180)),
          difficulty: difficulty || 'NORMAL',
          photoUrl: photoUrl || 'https://picsum.photos/800/600',
        };

        setGameGuess(guess, confidenceRadius || 1000);
        setGameGuess(null, confidenceRadius || 1000);
        navigation.replace('GameResult', resultParams);
      }
    } catch (error) {
      console.error('🗺️ Error submitting guess:', error);
      
      // Fallback to local calculation on network error
      const actualLocation = currentPhoto?.actualLocation || { latitude: 35.6762, longitude: 139.6503 };
      const distance = calculateDistance(
        guess.latitude,
        guess.longitude,
        actualLocation.latitude,
        actualLocation.longitude
      );
      const score = calculateScore(distance);
      
      const resultParams = {
        guess: {
          latitude: guess.latitude,
          longitude: guess.longitude,
        },
        actualLocation: {
          latitude: actualLocation.latitude,
          longitude: actualLocation.longitude,
        },
        score: score,
        timeUsed: Math.max(0, 180 - (timeLeft || 180)),
        difficulty: difficulty || 'NORMAL',
        photoUrl: photoUrl || 'https://picsum.photos/800/600',
      };

      setGameGuess(guess, confidenceRadius || 1000);
      setGameGuess(null, confidenceRadius || 1000);
      navigation.replace('GameResult', resultParams);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Overlay header - clickable to go back */}
      <TouchableOpacity 
        style={styles.overlayHeader}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <View style={styles.headerContent}>
          <View style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </View>
          <View style={styles.photoContainer}>
            <Image 
              source={{ uri: photoUrl }} 
              style={styles.photoThumbnail}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.difficulty}>{difficulty}</Text>
            <View style={styles.timer}>
              <Ionicons name="timer" size={18} color="#fff" />
              <Text style={styles.timerText}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* 地図 */}
      <MapView
        style={styles.fullMap}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        initialRegion={{
          latitude: initialGuess?.latitude || 35.6762,
          longitude: initialGuess?.longitude || 139.6503,
          latitudeDelta: initialGuess ? 5 : 50,
          longitudeDelta: initialGuess ? 5 : 50,
        }}
        onPress={(e) => setGuess(e.nativeEvent.coordinate)}
      >
        {guess && (
          <Marker
            coordinate={guess}
            draggable
            onDragEnd={(e) => setGuess(e.nativeEvent.coordinate)}
          >
            <View style={styles.guessMarker}>
              <Ionicons name="location" size={40} color="#FF0000" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* 送信ボタン */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitButton, (!guess || isSubmitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!guess || isSubmitting}
        >
          <LinearGradient
            colors={guess && !isSubmitting ? ['#4CAF50', '#45A049'] : ['#64748b', '#475569']}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? '送信中...' : guess ? '推測を送信' : '地図をタップして推測'}
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
  overlayHeader: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    zIndex: 1000,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  photoContainer: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  difficulty: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
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
  fullMap: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  guessMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
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