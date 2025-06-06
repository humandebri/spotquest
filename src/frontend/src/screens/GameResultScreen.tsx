import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GameResultProps {
  route: {
    params: {
      guess: { latitude: number; longitude: number };
      actualLocation: { latitude: number; longitude: number };
      score: number;
      timeUsed: number;
      azimuthGuess?: number;
      actualAzimuth?: number;
      difficulty?: string;
      photoUrl?: string;
    };
  };
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GameResultScreen({ route }: GameResultProps) {
  const navigation = useNavigation<NavigationProp>();
  const { 
    guess, 
    actualLocation, 
    score, 
    timeUsed,
    azimuthGuess = 0,
    actualAzimuth = 0,
    difficulty = 'NORMAL',
    photoUrl = 'https://picsum.photos/800/600',
  } = route.params;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = calculateDistance(
    guess.latitude,
    guess.longitude,
    actualLocation.latitude,
    actualLocation.longitude
  );

  const azimuthError = Math.abs(azimuthGuess - actualAzimuth);
  const normalizedAzimuthError = Math.min(azimuthError, 360 - azimuthError);

  // Rewards calculation
  const baseReward = 1.0; // 1.00 SPOT
  const earnedReward = (score / 100) * baseReward;

  // Performance evaluation
  const getPerformanceRating = () => {
    if (score >= 95) return { text: 'PERFECT!', color: '#FFD700', icon: 'trophy' };
    if (score >= 85) return { text: 'EXCELLENT!', color: '#4CAF50', icon: 'star' };
    if (score >= 70) return { text: 'GREAT!', color: '#2196F3', icon: 'thumbs-up' };
    if (score >= 50) return { text: 'GOOD!', color: '#FF9800', icon: 'happy' };
    return { text: 'NICE TRY!', color: '#9C27B0', icon: 'heart' };
  };

  const performance = getPerformanceRating();

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: 300,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Score counter animation
    Animated.timing(scoreAnim, {
      toValue: score,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored ${score} points in Guess the Spot! 🌍\nMy guess was ${distance.toFixed(1)}km away from the actual location.\nCan you beat my score?`,
        title: 'Guess the Spot Score',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handlePlayAgain = () => {
    navigation.navigate('Game');
  };

  const handleBackToMenu = () => {
    navigation.navigate('Home');
  };

  // Map region that includes both markers
  const getMapRegion = () => {
    const minLat = Math.min(guess.latitude, actualLocation.latitude);
    const maxLat = Math.max(guess.latitude, actualLocation.latitude);
    const minLon = Math.min(guess.longitude, actualLocation.longitude);
    const maxLon = Math.max(guess.longitude, actualLocation.longitude);
    
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Header */}
        <Animated.View 
          style={[
            styles.performanceHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.performanceIcon,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Ionicons name={performance.icon as any} size={60} color={performance.color} />
          </Animated.View>
          <Text style={[styles.performanceText, { color: performance.color }]}>
            {performance.text}
          </Text>
        </Animated.View>

        {/* Score Display */}
        <Animated.View style={[styles.scoreSection, { opacity: fadeAnim }]}>
          <View style={styles.scoreCircle}>
            <Animated.Text style={styles.scoreValue}>
              {scoreAnim.interpolate({
                inputRange: [0, score],
                outputRange: ['0', score.toString()],
              }).interpolate(val => Math.round(Number(val)).toString())}
            </Animated.Text>
            <Text style={styles.scoreLabel}>POINTS</Text>
          </View>
          
          <View style={styles.rewardInfo}>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>Earned:</Text>
              <Text style={styles.rewardValue}>+{earnedReward.toFixed(2)} SPOT</Text>
            </View>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardLabel}>Uploader:</Text>
              <Text style={styles.rewardValue}>+{(earnedReward * 0.3).toFixed(2)} SPOT</Text>
            </View>
          </View>
        </Animated.View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Ionicons name="navigate" size={24} color="#3282b8" />
            <Text style={styles.statValue}>{distance.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Distance Error</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="compass" size={24} color="#3282b8" />
            <Text style={styles.statValue}>{normalizedAzimuthError.toFixed(0)}°</Text>
            <Text style={styles.statLabel}>Azimuth Error</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="timer" size={24} color="#3282b8" />
            <Text style={styles.statValue}>
              {Math.floor(timeUsed / 60)}:{(timeUsed % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={styles.statLabel}>Time Used</Text>
          </View>
        </View>

        {/* Map Comparison */}
        <View style={styles.mapSection}>
          <Text style={styles.sectionTitle}>Location Comparison</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={getMapRegion()}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              {/* Your guess */}
              <Marker
                coordinate={guess}
                title="Your Guess"
              >
                <View style={styles.guessMarker}>
                  <Ionicons name="location" size={40} color="#FF0000" />
                </View>
              </Marker>
              
              {/* Actual location */}
              <Marker
                coordinate={actualLocation}
                title="Actual Location"
              >
                <View style={styles.actualMarker}>
                  <Ionicons name="flag" size={40} color="#4CAF50" />
                </View>
              </Marker>
              
              {/* Connection line */}
              <Polyline
                coordinates={[guess, actualLocation]}
                strokeColor="#FF0000"
                strokeWidth={3}
                lineDashPattern={[10, 5]}
              />
            </MapView>
            
            {/* Map Legend */}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <Ionicons name="location" size={20} color="#FF0000" />
                <Text style={styles.legendText}>Your Guess</Text>
              </View>
              <View style={styles.legendItem}>
                <Ionicons name="flag" size={20} color="#4CAF50" />
                <Text style={styles.legendText}>Actual Location</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Score Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.breakdownList}>
            <BreakdownItem
              label="Base Score"
              value={100}
              percentage={100}
            />
            <BreakdownItem
              label="Distance Penalty"
              value={-Math.round((distance / 10))}
              percentage={Math.max(0, 100 - (distance / 10))}
              negative
            />
            <BreakdownItem
              label="Azimuth Penalty"
              value={-Math.round(normalizedAzimuthError / 10)}
              percentage={Math.max(0, 100 - (normalizedAzimuthError / 10))}
              negative
            />
            <BreakdownItem
              label="Time Bonus"
              value={Math.round(Math.max(0, 180 - timeUsed) / 10)}
              percentage={Math.max(0, (180 - timeUsed) / 1.8)}
            />
            <BreakdownItem
              label={`${difficulty} Multiplier`}
              value={`x${getDifficultyMultiplier(difficulty)}`}
              percentage={100}
              multiplier
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePlayAgain}
          >
            <LinearGradient
              colors={['#4CAF50', '#45A049']}
              style={styles.buttonGradient}
            >
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.primaryButtonText}>Play Again</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={20} color="#3282b8" />
              <Text style={styles.secondaryButtonText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBackToMenu}
            >
              <Ionicons name="home" size={20} color="#3282b8" />
              <Text style={styles.secondaryButtonText}>Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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

const getDifficultyMultiplier = (difficulty: string): number => {
  const multipliers: { [key: string]: number } = {
    EASY: 0.8,
    NORMAL: 1.0,
    HARD: 1.5,
    EXTREME: 2.0,
  };
  return multipliers[difficulty] || 1.0;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  performanceHeader: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  performanceIcon: {
    marginBottom: 10,
  },
  performanceText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  scoreCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#3282b8',
    marginBottom: 20,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 5,
  },
  rewardInfo: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 12,
    width: '80%',
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  rewardLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  rewardValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 12,
    minWidth: 100,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  mapSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  map: {
    height: 300,
  },
  guessMarker: {
    alignItems: 'center',
  },
  actualMarker: {
    alignItems: 'center',
  },
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    padding: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    color: '#fff',
    fontSize: 12,
  },
  breakdownSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  breakdownList: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
  },
  breakdownItem: {
    marginBottom: 15,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  breakdownValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  negativeValue: {
    color: '#FF6B6B',
  },
  multiplierValue: {
    color: '#FFD700',
  },
  breakdownBar: {
    height: 4,
    backgroundColor: '#0f1117',
    borderRadius: 2,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    paddingHorizontal: 20,
  },
  primaryButton: {
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#3282b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
});