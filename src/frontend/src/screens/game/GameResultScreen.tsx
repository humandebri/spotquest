import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useGameStore } from '../../store/gameStore';
import Svg, { Circle, Path } from 'react-native-svg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type GameResultScreenRouteProp = RouteProp<RootStackParamList, 'GameResult'>;
type GameResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GameResult'>;

export default function GameResultScreen() {
  const navigation = useNavigation<GameResultScreenNavigationProp>();
  const route = useRoute<GameResultScreenRouteProp>();
  const { roundNumber, setRoundNumber, addRoundResult } = useGameStore();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Extract values directly from route to avoid object recreation
  const params = route?.params || {};
  
  // Initialize dash pattern (will be set properly after map ready)
  const [dashPattern, setDashPattern] = useState<number[]>([20, 20]);
  const timeUsed = params.timeUsed ?? 0;
  
  // Use flattened parameters if available (for React Navigation serialization fix)
  const guessLat = (params as any).guessLatitude ?? params.guess?.latitude ?? 0;
  const guessLon = (params as any).guessLongitude ?? params.guess?.longitude ?? 0;
  let actualLat = (params as any).actualLatitude ?? params.actualLocation?.latitude ?? 35.6762;
  let actualLon = (params as any).actualLongitude ?? params.actualLocation?.longitude ?? 139.6503;
  
  // Ensure longitude is positive (fix for serialization issue)
  actualLon = Math.abs(actualLon);
  
  // Debug: Log values after assignment
  console.log('🔍 DEBUG GameResult - actualLon after assignment (fixed):', actualLon);
  
  // Additional validation for extreme coordinates
  if (Math.abs(actualLat) > 90) actualLat = 35.6762;
  if (Math.abs(actualLon) > 180) actualLon = 139.6503;
  if (Math.abs(guessLat) > 90 || Math.abs(guessLon) > 180) {
    // Invalid guess coordinates, use defaults
    console.warn('🚨 Invalid coordinates detected in GameResult params');
  }
  const guess = useMemo(() => ({ latitude: guessLat, longitude: guessLon }), [guessLat, guessLon]);
  const actualLocation = useMemo(() => ({ latitude: actualLat, longitude: actualLon }), [actualLat, actualLon]);
  const score = params.score ? (typeof params.score === 'bigint' ? Number(params.score) : params.score) : 0;
  const difficulty = (params.difficulty || 'NORMAL') as 'NORMAL' | 'EASY' | 'HARD' | 'EXTREME';
  
  // Log params once on mount only (without photoUrl to avoid memory issues)
  useEffect(() => {
    const { photoUrl, ...safeParams } = params;
    console.log('🎯 GameResult route params:', {
      ...safeParams,
      photoUrl: photoUrl ? `[BASE64_${Math.round((photoUrl.length || 0) / 1024)}KB]` : undefined,
      isTimeout: timeUsed >= 180,
    });
  }, []); // Empty dependency array to run only once
  
  // Optimize photo URL handling - don't keep in memory, use placeholder
  const photoUrl = useMemo(() => {
    // For GameResult, we don't need the photo anymore
    // Use a placeholder to save memory
    return 'https://picsum.photos/800/600';
  }, []); // No dependencies, static value

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
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


  // Rewards calculation (based on 5000 point max)
  const baseReward = 1.0; // 1.00 SPOT for perfect score
  const earnedReward = ((score || 0) / 5000) * baseReward;

  // Performance optimization: disable animations for low scores (distant guesses)
  const isLightweightMode = score <= 500;


  // Use ref to track if initial setup is done
  const initialSetupDone = useRef(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount - stop animations and clean up
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Stop all animations to prevent memory leaks
      fadeAnim.stopAnimation();
      scoreAnim.stopAnimation();
      markerScaleAnim.stopAnimation();
      // Remove any listeners
      fadeAnim.removeAllListeners();
      scoreAnim.removeAllListeners();
      markerScaleAnim.removeAllListeners();
    };
  }, []);
  
  // Delay map rendering for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsMapLoading(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Only run once on mount
    if (initialSetupDone.current) return;
    initialSetupDone.current = true;
    
    // Save round result when component mounts
    if (guess && actualLocation && score !== undefined) {
      addRoundResult({
        roundNumber,
        score,
        guess,
        actualLocation,
        timeUsed,
        difficulty,
        photoUrl: undefined, // Don't store large Base64 in memory
      });
    }

    // Conditional animations based on score (check score directly instead of isLightweightMode)
    if (score <= 500) {
      // No animations for low scores - instant display
      fadeAnim.setValue(1);
      scoreAnim.setValue(score || 0);
      markerScaleAnim.setValue(1);
      // Set lightweight dash pattern
      setDashPattern([30, 30]);
    } else {
      // Full animations for good scores
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Delayed score animation to reduce initial load
      const scoreTimer = setTimeout(() => {
        if (isMountedRef.current) {
          Animated.timing(scoreAnim, {
            toValue: score || 0,
            duration: 1000,
            useNativeDriver: false,
          }).start();
        }
      }, 200);
      
      return () => clearTimeout(scoreTimer);
    }
  }, []); // Empty dependency array - run only once on mount

  // Map region that includes both markers - memoized with debug logging moved
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

    // Validate coordinates to prevent NaN/Infinity
    const guessLat = Number(guess.latitude) || 0;
    const guessLon = Number(guess.longitude) || 0;
    const actualLat = Number(actualLocation.latitude) || 0;
    const actualLon = Number(actualLocation.longitude) || 0;

    // Check for valid coordinate ranges
    if (Math.abs(guessLat) > 90 || Math.abs(actualLat) > 90 || 
        Math.abs(guessLon) > 180 || Math.abs(actualLon) > 180) {
      console.warn('🚨 Invalid coordinates detected, using default region');
      return {
        latitude: 35.6762,
        longitude: 139.6503,
        latitudeDelta: 90,
        longitudeDelta: 180,
      };
    }
    
    // Performance optimization: For extreme distances, use simpler calculation
    const latDiff = Math.abs(actualLat - guessLat);
    const lonDiff = Math.abs(actualLon - guessLon);
    
    if (latDiff > 45 || lonDiff > 90) {
      // Extreme distance - use simplified region
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 90,
        longitudeDelta: 180,
      };
    }

    const minLat = Math.min(guessLat, actualLat);
    const maxLat = Math.max(guessLat, actualLat);
    const minLon = Math.min(guessLon, actualLon);
    const maxLon = Math.max(guessLon, actualLon);
    
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    
    // Calculate deltas with sufficient padding to ensure both points are visible
    const latRange = Math.abs(maxLat - minLat);
    const lonRange = Math.abs(maxLon - minLon);
    
    // Use larger multiplier for better visibility, with minimum zoom levels
    const paddingMultiplier = 4.0;
    const minLatDelta = 0.005;
    const minLonDelta = 0.005;
    
    // Ensure adequate padding especially for close points
    const paddedLatDiff = Math.max(latRange * paddingMultiplier, minLatDelta);
    const paddedLonDiff = Math.max(lonRange * paddingMultiplier, minLonDelta);
    
    // For very close points, ensure minimum visible area
    const finalMinLatDelta = latRange < 0.01 ? 0.02 : minLatDelta;
    const finalMinLonDelta = lonRange < 0.01 ? 0.02 : minLonDelta;
    
    // Additional safety for extreme distances (> 1000km)
    const distanceKm = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111; // Rough km conversion
    const maxDelta = distanceKm > 1000 ? 45 : 90; // Limit zoom out for extreme distances
    
    const deltaLat = Math.min(Math.max(paddedLatDiff, finalMinLatDelta), maxDelta);
    const deltaLon = Math.min(Math.max(paddedLonDiff, finalMinLonDelta), maxDelta * 2);

    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: deltaLat,
      longitudeDelta: deltaLon,
    };
  }, [guessLat, guessLon, actualLat, actualLon]);


  // Calculate dash pattern based on map zoom level with performance optimization
  const calculateDashPattern = useCallback((region: any) => {
    // Skip calculation for low scores or long distances - pattern already set
    if (score <= 500 || !region || distance > 500000) {
      return;
    }
    
    const delta = region.latitudeDelta || 0.1;
    // Smaller delta = more zoomed in = smaller dash pattern
    // Larger delta = more zoomed out = larger dash pattern
    const basePattern = Math.max(20, Math.min(100, delta * 500));
    setDashPattern(prev => {
      if (prev[0] === basePattern && prev[1] === basePattern) return prev;
      return [basePattern, basePattern];
    });
  }, [score, distance]);

  // Removed - moved earlier for proper initialization order

  // Get distance-appropriate initial zoom level - memoized with stable values
  const initialZoomDelta = useMemo(() => {
    const distanceKm = distance / 1000;
    
    // Special handling for lightweight mode
    if (isLightweightMode && distanceKm > 1000) {
      // Use the calculated map region for extreme distances
      const region = getMapRegion;
      return { 
        lat: Math.min(region.latitudeDelta, 45), 
        lon: Math.min(region.longitudeDelta, 90) 
      };
    }
    
    if (distanceKm < 1) {
      return { lat: 0.01, lon: 0.01 };
    } else if (distanceKm < 10) {
      return { lat: 0.05, lon: 0.05 };
    } else if (distanceKm < 100) {
      return { lat: 0.5, lon: 0.5 };
    } else if (distanceKm < 1000) {
      return { lat: 5, lon: 5 };
    } else if (distanceKm < 5000) {
      return { lat: 40, lon: 40 };
    } else {
      // For very distant locations (> 5000km), use reasonable zoom out
      return { lat: 60, lon: 120 };
    }
  }, [distance, isLightweightMode, getMapRegion]);
  
  const getInitialZoom = useMemo(() => ({
    latitudeDelta: initialZoomDelta.lat,
    longitudeDelta: initialZoomDelta.lon,
  }), [initialZoomDelta.lat, initialZoomDelta.lon]);
  
  // Memoize initial region to prevent MapView remounting
  const initialRegion = useMemo(() => ({
    latitude: actualLat,
    longitude: actualLon,
    latitudeDelta: getInitialZoom.latitudeDelta,
    longitudeDelta: getInitialZoom.longitudeDelta,
  }), [actualLat, actualLon, getInitialZoom.latitudeDelta, getInitialZoom.longitudeDelta]);
  
  // Track if initial map setup is done to prevent repeated animations
  const mapSetupDone = useRef(false);
  
  // Conditional map animation based on performance mode
  useEffect(() => {
    if (mapReady && mapRef.current && actualLocation && guess && !mapSetupDone.current) {
      mapSetupDone.current = true;
      
      // Get stable region object
      const regionToAnimate = getMapRegion;
      
      // Validate region to prevent map crashes
      if (!regionToAnimate || 
          isNaN(regionToAnimate.latitude) || 
          isNaN(regionToAnimate.longitude) ||
          isNaN(regionToAnimate.latitudeDelta) ||
          isNaN(regionToAnimate.longitudeDelta)) {
        console.warn('🗺️ Invalid map region, skipping animation');
        return;
      }
      
      const isLowScore = score <= 500;
      
      if (isLowScore) {
        // Lightweight mode: simplified animation for extreme coordinates
        // Check if coordinates are extremely far apart
        const isExtremeDistance = regionToAnimate.latitudeDelta >= 30 || regionToAnimate.longitudeDelta >= 60;
        
        if (isExtremeDistance) {
          // For extreme distances, just set the region without animation
          try {
            mapRef.current?.setCamera({
              center: {
                latitude: regionToAnimate.latitude,
                longitude: regionToAnimate.longitude,
              },
              zoom: 3, // Very zoomed out for extreme distances
            });
            markerScaleAnim.setValue(1);
          } catch (error) {
            console.warn('🗺️ Extreme distance camera set failed:', error);
          }
        } else {
          // Normal lightweight animation
          const lightweightTimer = setTimeout(() => {
            if (isMountedRef.current) {
              try {
                mapRef.current?.animateToRegion(regionToAnimate, 100); // Very fast animation
                markerScaleAnim.setValue(1);
              } catch (error) {
                console.warn('🗺️ Lightweight mode map animation failed:', error);
              }
            }
          }, 50);
          
          return () => clearTimeout(lightweightTimer);
        }
      } else {
        // Full animation for good scores
        const mapTimer = setTimeout(() => {
          if (isMountedRef.current) {
            try {
              mapRef.current?.animateToRegion(regionToAnimate, 1500);
              calculateDashPattern(regionToAnimate);
              
              // Animated marker appearance
              Animated.timing(markerScaleAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }).start();
            } catch (error) {
              console.warn('🗺️ Full mode map animation failed:', error);
            }
          }
        }, 300);
        
        return () => clearTimeout(mapTimer);
      }
    }
  }, [mapReady, getMapRegion, score]); // Use score directly instead of isLightweightMode

  // No token minting here - will be done at session completion

  const handlePlayAgain = () => {
    // Check if this was the last round (or if we've somehow exceeded 5 rounds)
    if (roundNumber >= 5) {
      // Navigate to session summary
      navigation.replace('SessionSummary');
    } else {
      // Validate round number before incrementing
      const nextRound = Math.min(roundNumber + 1, 5); // Cap at 5 to prevent exceeding max rounds
      console.log('🎮 GameResult - Moving to round', nextRound, 'from round', roundNumber);
      setRoundNumber(nextRound);
      
      // Navigate directly to GamePlayScreen for next round using replace to avoid stack issues
      // Important: preserve any region filter from the original game params
      const regionFilter = (route.params as any)?.regionFilter;
      const regionName = (route.params as any)?.regionName;
      
      navigation.replace('GamePlay', {
        gameMode: 'normal',
        difficulty: difficulty,
        regionFilter: regionFilter,
        regionName: regionName,
      });
    }
  };


  return (
    <View style={styles.container}>
      {/* Conditional Background based on performance mode */}
      {isLightweightMode ? (
        // Simple solid background for performance
        <View style={styles.lightweightBackground} />
      ) : (
        <>
          {/* Gradient Mesh Background */}
          <LinearGradient
            colors={['#1a0033', '#220044', '#1a0033']}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Simplified Background Pattern */}
          <View style={styles.simpleOverlay} pointerEvents="none" />
        </>
      )}
      
      {/* Map Section - Full Width */}
      <View style={styles.mapContainer}>
        {guess && actualLocation && 
         typeof guess.latitude === 'number' && typeof guess.longitude === 'number' &&
         typeof actualLocation.latitude === 'number' && typeof actualLocation.longitude === 'number' &&
         !isNaN(guess.latitude) && !isNaN(guess.longitude) &&
         !isNaN(actualLocation.latitude) && !isNaN(actualLocation.longitude) &&
         Math.abs(guess.latitude) <= 90 && Math.abs(actualLocation.latitude) <= 90 &&
         Math.abs(guess.longitude) <= 180 && Math.abs(actualLocation.longitude) <= 180 ? (
          isMapLoading ? (
            <View style={styles.mapLoadingContainer}>
              <Text style={styles.mapLoadingText}>Loading Map...</Text>
            </View>
          ) : (
          <MapView
            ref={mapRef}
            style={styles.fullMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            onMapReady={() => {
              if (mapReady) return; // Prevent double execution
              setMapReady(true);
              // Only calculate dash pattern for non-lightweight mode
              if (!isLightweightMode) {
                calculateDashPattern({ latitudeDelta: getInitialZoom.latitudeDelta });
              }
            }}
            onRegionChangeComplete={undefined} // Disable to prevent memory leak
            scrollEnabled={!isLightweightMode || distance > 100000} // Allow scroll for extreme distances
            zoomEnabled={!isLightweightMode || distance > 100000} // Allow zoom for extreme distances
            rotateEnabled={false}
            pitchEnabled={false}
            // Adjust zoom levels based on distance
            minZoomLevel={distance > 5000000 ? 0 : (isLightweightMode ? 2 : 0)} // Allow full zoom out for extreme distances
            maxZoomLevel={isLightweightMode ? 15 : 20} // Allow more zoom in lightweight mode
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
            
            {/* Connection line - solid for long distances to save memory */}
            {distance < 500000 ? ( // Show dotted line only for distances < 500km
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
            ) : (
              // Solid line for long distances to prevent memory issues
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
                geodesic={true} // Use geodesic for accurate long-distance lines
              />
            )}
          </MapView>
          )
        ) : (
          // Fallback when coordinates are invalid
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={48} color="#666" />
            <Text style={styles.mapFallbackText}>
              Map unavailable for extreme locations
            </Text>
            <Text style={styles.mapFallbackSubtext}>
              Distance: {distance < 1000 
                ? `${Math.round(distance || 0)} m` 
                : `${((distance || 0) / 1000).toFixed(1)} km`}
            </Text>
          </View>
        )}
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
          {isLightweightMode && (
            <View style={styles.lightweightIndicator}>
              <Ionicons name="flash" size={16} color="#FFC107" />
              <Text style={styles.lightweightText}>Fast Mode</Text>
            </View>
          )}
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
  lightweightBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#1a0033',
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
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    gap: 12,
  },
  mapFallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  mapFallbackSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
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
  lightweightIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
    gap: 4,
  },
  lightweightText: {
    color: '#FFC107',
    fontSize: 12,
    fontWeight: '600',
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
  mapLoadingContainer: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
});