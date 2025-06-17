import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { BlurView } from 'expo-blur';
import { useGameStore } from '../../store/gameStore';
import Svg, { Circle, Path } from 'react-native-svg';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type GameResultScreenRouteProp = RouteProp<RootStackParamList, 'GameResult'>;
type GameResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GameResult'>;

export default function GameResultScreen() {
  const navigation = useNavigation<GameResultScreenNavigationProp>();
  const route = useRoute<GameResultScreenRouteProp>();
  const { resetGame, sessionId, tokenBalance, setTokenBalance, roundNumber, setRoundNumber, addRoundResult } = useGameStore();
  const { principal, identity } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [dashPattern, setDashPattern] = useState([20, 20]);
  const [sessionFinalized, setSessionFinalized] = useState(false);
  const [actualReward, setActualReward] = useState<number>(0);
  
  // Error handling from GameResultScreenSimple
  let params = {};
  try {
    params = route?.params || {};
  } catch (error) {
    console.error('Error getting params:', error);
  }
  
  console.log('🎯 GameResult route params:', {
    ...params,
    photoUrl: params.photoUrl ? `[IMAGE_DATA_${(params.photoUrl?.length || 0 / 1024).toFixed(0)}KB]` : undefined,
    isTimeout: timeUsed >= 180 // Detect timeout condition
  });
  
  // Performance monitoring for timeout scenarios
  if (timeUsed >= 180) {
    console.warn('⏰ Timeout detected in GameResult - using optimized rendering');
  }
  
  // Ensure all values have defaults
  const guess = params.guess || { latitude: 0, longitude: 0 };
  const actualLocation = params.actualLocation || { latitude: 35.6762, longitude: 139.6503 };
  const score = typeof params.score === 'bigint' ? Number(params.score) : (params.score ?? 0);
  const timeUsed = params.timeUsed ?? 0;
  const azimuthGuess = params.azimuthGuess ?? 0;
  const actualAzimuth = params.actualAzimuth ?? 0;
  const difficulty = params.difficulty || 'NORMAL';
  // Optimize photo URL handling for performance
  const photoUrl = useMemo(() => {
    const url = params.photoUrl;
    // For very large Base64 strings, use placeholder to avoid memory issues
    if (url && url.length > 2000000) { // 2MB
      console.warn('📸 Large photo data detected, using placeholder');
      return 'https://picsum.photos/800/600';
    }
    return url || 'https://picsum.photos/800/600';
  }, [params.photoUrl]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const markerScaleAnim = useRef(new Animated.Value(0)).current;

  // Calculate distance using Haversine formula (in meters) - memoized
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const distance = useMemo(() => {
    if (guess && actualLocation && 
        typeof guess.latitude === 'number' && 
        typeof guess.longitude === 'number' && 
        typeof actualLocation.latitude === 'number' && 
        typeof actualLocation.longitude === 'number') {
      return calculateDistance(
        guess.latitude,
        guess.longitude,
        actualLocation.latitude,
        actualLocation.longitude
      );
    }
    return 0;
  }, [guess, actualLocation, calculateDistance]);

  const azimuthError = Math.abs((azimuthGuess || 0) - (actualAzimuth || 0));
  const normalizedAzimuthError = Math.min(azimuthError, 360 - azimuthError);

  // Rewards calculation (based on 5000 point max)
  const baseReward = 1.0; // 1.00 SPOT for perfect score
  const earnedReward = ((score || 0) / 5000) * baseReward;


  // Difficulty multiplier function
  const getDifficultyMultiplier = (diff: string) => {
    switch (diff) {
      case 'EASY': return 0.8;
      case 'NORMAL': return 1.0;
      case 'HARD': return 1.5;
      case 'EXTREME': return 2.0;
      default: return 1.0;
    }
  };

  useEffect(() => {
    // Save round result when component mounts
    if (guess && actualLocation && score !== undefined) {
      addRoundResult({
        roundNumber,
        score,
        guess,
        actualLocation,
        timeUsed,
        difficulty,
        photoUrl,
      });
    }

    // Simplified entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Delayed score animation to reduce initial load
    const scoreTimer = setTimeout(() => {
      Animated.timing(scoreAnim, {
        toValue: score || 0,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }, 200);

    return () => clearTimeout(scoreTimer);
  }, []);

  // Get distance-appropriate initial zoom level - memoized
  const getInitialZoom = useMemo(() => {
    const distanceKm = distance / 1000;
    
    if (distanceKm < 1) {
      return { latitudeDelta: 0.01, longitudeDelta: 0.01 };
    } else if (distanceKm < 10) {
      return { latitudeDelta: 0.05, longitudeDelta: 0.05 };
    } else if (distanceKm < 100) {
      return { latitudeDelta: 0.5, longitudeDelta: 0.5 };
    } else if (distanceKm < 1000) {
      return { latitudeDelta: 5, longitudeDelta: 5 };
    } else {
      return { latitudeDelta: 20, longitudeDelta: 20 };
    }
  }, [distance]);

  // Simplified map animation
  useEffect(() => {
    if (mapReady && mapRef.current && actualLocation && guess) {
      // Delayed animation to avoid blocking UI
      const mapTimer = setTimeout(() => {
        mapRef.current?.animateToRegion(getMapRegion, 1500);
        calculateDashPattern(getMapRegion);
        
        // Simple marker appearance
        markerScaleAnim.setValue(1);
      }, 300);
      
      return () => clearTimeout(mapTimer);
    }
  }, [mapReady, getMapRegion, actualLocation, guess]);

  // No token minting here - will be done at session completion

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored ${score || 0} points in Guess the Spot! 🌍\nMy guess was ${distance < 1000 ? `${Math.round(distance || 0)}m` : `${((distance || 0) / 1000).toFixed(1)}km`} away from the actual location.\nCan you beat my score?`,
        title: 'Guess the Spot Score',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handlePlayAgain = () => {
    // Check if this was the last round
    if (roundNumber >= 5) {
      // Navigate to session summary
      navigation.replace('SessionSummary');
    } else {
      // Increment round number for next round
      setRoundNumber(roundNumber + 1);
      
      // Navigate directly to GamePlayScreen for next round
      navigation.replace('GamePlay', {
        gameMode: 'normal',
        difficulty: difficulty,
      });
    }
  };

  const handleBackToMenu = () => {
    // Reset navigation stack to home
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  // Map region that includes both markers - memoized
  const getMapRegion = useMemo(() => {
    // Safety checks
    if (!guess || !actualLocation) {
      return {
        latitude: 35.6762,
        longitude: 139.6503,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    const minLat = Math.min(guess.latitude || 0, actualLocation.latitude || 0);
    const maxLat = Math.max(guess.latitude || 0, actualLocation.latitude || 0);
    const minLon = Math.min(guess.longitude || 0, actualLocation.longitude || 0);
    const maxLon = Math.max(guess.longitude || 0, actualLocation.longitude || 0);
    
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    const deltaLat = Math.max(maxLat - minLat, 0.05) * 1.5;
    const deltaLon = Math.max(maxLon - minLon, 0.05) * 1.5;

    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: deltaLat,
      longitudeDelta: deltaLon,
    };
  }, [guess, actualLocation]);

  // Calculate dash pattern based on map zoom level
  const calculateDashPattern = (region: any) => {
    const delta = region.latitudeDelta || 0.1;
    // Smaller delta = more zoomed in = smaller dash pattern
    // Larger delta = more zoomed out = larger dash pattern
    const basePattern = Math.max(20, Math.min(100, delta * 500));
    setDashPattern([basePattern, basePattern]);
  };

  return (
    <View style={styles.container}>
      {/* Gradient Mesh Background */}
      <LinearGradient
        colors={['#1a0033', '#220044', '#1a0033']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Simplified Background Pattern - Removed heavy mesh overlay */}
      <View style={styles.simpleOverlay} pointerEvents="none" />
      
      {/* Map Section - Full Width */}
      <View style={styles.mapContainer}>
        {guess && actualLocation && 
         typeof guess.latitude === 'number' && typeof guess.longitude === 'number' &&
         typeof actualLocation.latitude === 'number' && typeof actualLocation.longitude === 'number' &&
         !isNaN(guess.latitude) && !isNaN(guess.longitude) &&
         !isNaN(actualLocation.latitude) && !isNaN(actualLocation.longitude) ? (
          <MapView
            ref={mapRef}
            style={styles.fullMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: actualLocation.latitude,
              longitude: actualLocation.longitude,
              ...getInitialZoom,
            }}
            onMapReady={() => {
              setMapReady(true);
              const initialZoom = getInitialZoom();
              calculateDashPattern({ latitudeDelta: initialZoom.latitudeDelta });
            }}
            onRegionChangeComplete={(region) => {
              calculateDashPattern(region);
            }}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {/* Your guess marker - Google Maps style current location */}
            <Marker
              coordinate={{
                latitude: Number(guess.latitude),
                longitude: Number(guess.longitude),
              }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Animated.View style={[
                {
                  transform: [{ scale: markerScaleAnim }],
                }
              ]}>
                <Svg width="30" height="30" viewBox="0 0 30 30">
                  {/* White outer circle with shadow effect */}
                  <Circle cx="15" cy="15" r="14" fill="#FFFFFF" stroke="#00000020" strokeWidth="1" />
                  {/* Blue inner circle - larger */}
                  <Circle cx="15" cy="15" r="10" fill="#4285F4" />
                </Svg>
              </Animated.View>
            </Marker>
            
            {/* Actual location marker - Flag icon with circle */}
            <Marker
              coordinate={{
                latitude: Number(actualLocation.latitude),
                longitude: Number(actualLocation.longitude),
              }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Animated.View style={[
                {
                  transform: [{ scale: markerScaleAnim }],
                }
              ]}>
                <Svg width="30" height="30" viewBox="0 0 30 30">
                  {/* Black circle background with white border */}
                  <Circle cx="15" cy="15" r="13" fill="#000000" stroke="#FFFFFF" strokeWidth="2" />
                  {/* White flag icon centered */}
                  <Path
                    d="M 13.5 20 V 10 L 20.5 8 C 20.8 7.9 21 7.6 21 7.3 S 20.8 6.9 20.5 6.8 L 12.5 4 C 12.2 3.9 11.9 3.9 11.7 4.1 C 11.5 4.2 11.4 4.5 11.4 4.8 V 20 H 13.5 Z"
                    fill="#FFFFFF"
                  />
                </Svg>
              </Animated.View>
            </Marker>
            
            {/* Black dotted line */}
            <Polyline
              coordinates={[
                {
                  latitude: Number(guess.latitude),
                  longitude: Number(guess.longitude),
                },
                {
                  latitude: Number(actualLocation.latitude),
                  longitude: Number(actualLocation.longitude),
                },
              ]}
              strokeColor="#000000"
              strokeWidth={2}
              lineDashPattern={dashPattern}
              lineJoin="round"
              lineCap="round"
            />
          </MapView>
        ) : null}
      </View>

      {/* Bottom Section with Results */}
      <LinearGradient
        colors={['#1a0033', '#220044', '#2d1b69']}
        style={styles.resultsSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.roundIndicator}>
          <Ionicons name="location-outline" size={24} color="#fff" />
          <Text style={styles.roundText}>ROUND {roundNumber}</Text>
        </View>

        <Animated.Text style={[styles.pointsText, { opacity: fadeAnim }]}>
          {score || 0} points
        </Animated.Text>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min((score / 5000) * 100, 100)}%` 
                }
              ]} 
            />
          </View>
        </View>

        {/* Token Rewards */}
        <View style={styles.rewardContainer}>
          <Text style={styles.rewardText}>
            You earned: +{earnedReward.toFixed(2)} SPOT
          </Text>
          <Text style={styles.uploaderRewardText}>
            Photo uploader earned: +{(earnedReward * 0.3).toFixed(2)} SPOT
          </Text>
        </View>

        <Text style={styles.distanceMessage}>
          You guessed {distance < 1000 
            ? `${Math.round(distance || 0)} m` 
            : `${((distance || 0) / 1000).toFixed(1)} km`
          } from the correct location
        </Text>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handlePlayAgain}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {roundNumber >= 5 ? 'VIEW RESULTS' : 'NEXT ROUND'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// Helper component for score breakdown
const BreakdownItem = ({ 
  label, 
  value, 
  percentage, 
  negative = false,
  multiplier = false 
}: {
  label: string;
  value: number | string;
  percentage: number;
  negative?: boolean;
  multiplier?: boolean;
}) => (
  <View style={styles.breakdownItem}>
    <View style={styles.breakdownHeader}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[
        styles.breakdownValue,
        negative && styles.negativeValue,
        multiplier && styles.multiplierValue,
      ]}>
        {typeof value === 'number' && value > 0 ? '+' : ''}{value}
      </Text>
    </View>
    {!multiplier && (
      <View style={styles.breakdownBar}>
        <Animated.View
          style={[
            styles.breakdownBarFill,
            {
              width: `${percentage}%`,
              backgroundColor: negative ? '#FF6B6B' : '#4CAF50',
            },
          ]}
        />
      </View>
    )}
  </View>
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  simpleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(147, 51, 234, 0.05)',
  },
  meshLine: {
    position: 'absolute',
    backgroundColor: '#9333EA',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#87CEEB', // Light blue background like the screenshot
  },
  fullMap: {
    flex: 1,
  },
  circleMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  guessCircle: {
    backgroundColor: '#8B4F9F', // Purple color
  },
  actualCircle: {
    backgroundColor: '#000000', // Black center
    borderWidth: 3,
    borderColor: '#FFD700', // Yellow border
  },
  resultsSection: {
    height: SCREEN_HEIGHT * 0.40, // 40% of screen height
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  progressBarContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  rewardContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  uploaderRewardText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  distanceMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 30,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});