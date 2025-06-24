import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { gameService } from '../../services/game';
import { photoService } from '../../services/photo';
import { useAuth } from '../../hooks/useAuth';

type SessionDetailsRouteProp = RouteProp<RootStackParamList, 'SessionDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SessionDetails'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RoundData {
  photoId: number;
  status: string;
  score: number;
  scoreNorm: number;
  guessData?: {
    lat: number;
    lon: number;
    azimuth?: number;
    confidenceRadius: number;
    submittedAt: bigint;
  };
  retryAvailable: boolean;
  hintsPurchased: any[];
  startTime: bigint;
  endTime?: bigint;
  photoUrl?: string;
  photoLocation?: {
    lat: number;
    lon: number;
  };
  photoMeta?: any; // Store full metadata
}

export default function SessionDetailsScreen() {
  console.log('🎯 ===== SessionDetailsScreen RENDER START =====');

  const route = useRoute<SessionDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { sessionId } = route.params || {};
  const { identity } = useAuth();

  console.log('🎯 SessionDetailsScreen mounted with params:', {
    sessionId,
    params: route.params,
    hasIdentity: !!identity,
    identityType: identity?.constructor?.name,
    routeName: route.name
  });

  const [session, setSession] = useState<any>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const [selectedRound, setSelectedRound] = useState<number>(0);
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>({});
  const [hasFetched, setHasFetched] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState<{ [key: number]: boolean }>({});
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    console.log('🎯 SessionDetailsScreen useEffect triggered:', {
      sessionId,
      hasIdentity: !!identity,
      identityPrincipal: identity?.getPrincipal?.()?.toString(),
      isLoading
    });

    if (sessionId && identity) {
      fetchSessionDetails();
    } else {
      console.warn('🎯 Missing sessionId or identity:', { sessionId, hasIdentity: !!identity });
    }
  }, [sessionId, identity]);

  // Debug selected round data and update map
  useEffect(() => {
    if (rounds.length > 0 && rounds[selectedRound]) {
      console.log('🎯 Current selected round:', {
        round: selectedRound + 1,
        photoUrl: rounds[selectedRound].photoUrl?.substring(0, 100),
        hasGuessData: !!rounds[selectedRound].guessData,
        hasPhotoLocation: !!rounds[selectedRound].photoLocation,
      });
      
      // Fit map to markers when round changes
      setTimeout(() => {
        fitMapToMarkers();
      }, 100);
    }
  }, [selectedRound, rounds]);

  const fetchSessionDetails = async () => {
    console.log('🎯 fetchSessionDetails called:', { sessionId, hasIdentity: !!identity, hasFetched, isLoading });

    if (!identity || !sessionId) {
      console.error('🎯 Cannot fetch: missing identity or sessionId');
      setIsLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (hasFetched || (isLoading && session)) {
      console.log('🎯 Already fetched or loading with data, skipping');
      return;
    }

    setHasFetched(true);
    try {
      // Initialize both game and photo services
      await gameService.init(identity);
      await photoService.init(identity);

      // Get session details
      console.log('🎯 Calling gameService.getSession with:', sessionId);
      const sessionResult = await gameService.getSession(sessionId);
      console.log('🎯 Session result:', sessionResult);

      if (!sessionResult) {
        console.error('🎯 No session result returned');
        Alert.alert('Error', 'Session not found');
        return;
      }

      if (sessionResult?.ok) {
        console.log('🎯 Session data:', sessionResult.ok);
        setSession(sessionResult.ok);

        // Process rounds WITHOUT photo data first
        const initialRounds = sessionResult.ok.rounds.map((round: any, index: number) => {
          const roundData: RoundData = {
            photoId: Number(round.photoId),
            status: round.status,
            score: Number(round.score),
            scoreNorm: Number(round.scoreNorm),
            guessData: round.guessData?.[0] ? {
              lat: round.guessData[0].lat,
              lon: round.guessData[0].lon,
              azimuth: round.guessData[0].azimuth?.[0] || undefined,
              confidenceRadius: round.guessData[0].confidenceRadius,
              submittedAt: round.guessData[0].submittedAt,
            } : undefined,
            retryAvailable: round.retryAvailable,
            hintsPurchased: round.hintsPurchased,
            startTime: round.startTime,
            endTime: round.endTime?.[0] || undefined,
            photoUrl: undefined,
            photoLocation: undefined,
            photoMeta: undefined,
          };
          return roundData;
        });

        // Set rounds immediately so UI can render
        setRounds(initialRounds);
        setIsLoading(false); // Stop loading spinner
        console.log('🎯 Initial rounds set, UI should be visible now');

        // Fetch photo data asynchronously after UI is rendered
        console.log('🎯 Starting async photo data fetch...');

        // Mark all photos as loading
        const loadingStates: { [key: number]: boolean } = {};
        initialRounds.forEach((_, index) => {
          loadingStates[index] = true;
        });
        setLoadingPhotos(loadingStates);

        // Create array of indices to fetch, starting with selected round
        const fetchOrder = [0]; // Start with first round (default selected)
        for (let i = 1; i < initialRounds.length; i++) {
          fetchOrder.push(i);
        }

        // Fetch photos in order of priority with slight delay
        fetchOrder.forEach(async (index, orderIndex) => {
          // Add small delay between requests (except for first one)
          if (orderIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, orderIndex * 100));
          }

          const roundData = initialRounds[index];
          try {
            console.log('🎯 Fetching photo for round:', index + 1, 'photoId:', roundData.photoId);
            const photoMeta = await photoService.getPhotoMetadataV2(roundData.photoId);

            if (photoMeta) {
              // Update photo location and metadata immediately
              setRounds(prevRounds => {
                const newRounds = [...prevRounds];
                newRounds[index] = {
                  ...newRounds[index],
                  photoLocation: {
                    lat: photoMeta.latitude,
                    lon: photoMeta.longitude,
                  },
                  photoMeta: photoMeta,
                };
                return newRounds;
              });

              // Check if photo is complete and active
              if (photoMeta.uploadState?.Complete !== undefined && photoMeta.status?.Active !== undefined) {
                // Get photo chunks for display
                const photoUrl = await photoService.getPhotoDataUrl(roundData.photoId, photoMeta);
                if (photoUrl) {
                  console.log('🎯 Photo URL generated for round:', index + 1);
                  // Update specific round with photo URL
                  setRounds(prevRounds => {
                    const newRounds = [...prevRounds];
                    newRounds[index] = {
                      ...newRounds[index],
                      photoUrl: photoUrl
                    };
                    return newRounds;
                  });
                }
              }
            }

            // Clear loading state for this photo
            setLoadingPhotos(prev => ({
              ...prev,
              [index]: false
            }));
          } catch (error) {
            console.error('🎯 Failed to fetch photo data for round:', index + 1, error);
            // Clear loading state even on error
            setLoadingPhotos(prev => ({
              ...prev,
              [index]: false
            }));
          }
        });

        return; // Exit early, don't wait for photos
      }
    } catch (error) {
      console.error('Failed to fetch session details:', error);
      console.error('Error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      Alert.alert('Error', 'Failed to load session details');
    } finally {
      setIsLoading(false);
      console.log('🎯 fetchSessionDetails completed, isLoading set to false');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  
  const calculateRoundDuration = (startTime: bigint, endTime?: bigint): string => {
    if (!endTime) return 'In Progress';
    
    // Convert nanoseconds to seconds
    const durationNanos = endTime - startTime;
    const durationSeconds = Number(durationNanos / BigInt(1000000000));
    
    if (durationSeconds < 60) {
      return `${durationSeconds}s`;
    } else {
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      return `${minutes}m ${seconds}s`;
    }
  };

  const fitMapToMarkers = () => {
    if (!mapRef.current || !rounds[selectedRound]) return;

    const round = rounds[selectedRound];
    if (!round.guessData || !round.photoLocation) return;

    const coords = [
      {
        latitude: round.guessData.lat,
        longitude: round.guessData.lon,
      },
      {
        latitude: round.photoLocation.lat,
        longitude: round.photoLocation.lon,
      },
    ];

    // Calculate distance to determine appropriate padding
    const distance = calculateDistance(
      round.guessData.lat,
      round.guessData.lon,
      round.photoLocation.lat,
      round.photoLocation.lon
    );
    
    // Adjust padding based on distance
    const padding = distance < 5 ? 100 : 
                   distance < 50 ? 80 : 
                   distance < 500 ? 60 : 50;

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: padding, right: padding, bottom: padding, left: padding },
      animated: true,
    });
  };

  if (isLoading || (!session && sessionId)) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading session...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (!session || rounds.length === 0) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  const currentRound = rounds[selectedRound];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Session Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Session Summary</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Score</Text>
                <Text style={styles.statValue}>{session.totalScore}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Rounds</Text>
                <Text style={styles.statValue}>{rounds.length}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>
                  {session.endTime ? 'Completed' : 'Active'}
                </Text>
              </View>
            </View>
          </View>

          {/* Round Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.roundSelector}
            contentContainerStyle={styles.roundSelectorContent}
          >
            {rounds.map((round, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.roundTab,
                  selectedRound === index && styles.roundTabActive,
                ]}
                onPress={() => setSelectedRound(index)}
              >
                <Text style={[
                  styles.roundTabText,
                  selectedRound === index && styles.roundTabTextActive,
                ]}>
                  Round {index + 1}
                </Text>
                <Text style={[
                  styles.roundTabScore,
                  selectedRound === index && styles.roundTabScoreActive,
                ]}>
                  {round.score} pts
                </Text>
                <Text style={[
                  styles.roundTabTime,
                  selectedRound === index && styles.roundTabTimeActive,
                ]}>
                  {calculateRoundDuration(round.startTime, round.endTime)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Round Details */}
          <View style={styles.roundDetails}>
            {/* Photo */}
            {loadingPhotos[selectedRound] ? (
              <View style={[styles.photoContainer, styles.photoPlaceholder]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.photoPlaceholderText}>Loading photo...</Text>
              </View>
            ) : currentRound.photoUrl && !imageErrors[currentRound.photoId] ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: currentRound.photoUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('🎯 Image loading error:', error.nativeEvent.error);
                    console.error('🎯 Failed to load image URL:', currentRound.photoUrl?.substring(0, 100));
                    setImageErrors(prev => ({ ...prev, [currentRound.photoId]: true }));
                  }}
                  onLoad={() => {
                    console.log('🎯 Image loaded successfully for round:', selectedRound + 1);
                  }}
                />
              </View>
            ) : (
              <View style={[styles.photoContainer, styles.photoPlaceholder]}>
                <Ionicons name="image-outline" size={48} color="#64748b" />
                <Text style={styles.photoPlaceholderText}>Photo not available</Text>
              </View>
            )}

            {/* Map */}
            {currentRound.guessData && currentRound.photoLocation ? (
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  key={`map-round-${selectedRound}`} // Force re-render when round changes
                  initialRegion={{
                    latitude: (currentRound.guessData.lat + currentRound.photoLocation.lat) / 2,
                    longitude: (currentRound.guessData.lon + currentRound.photoLocation.lon) / 2,
                    latitudeDelta: Math.abs(currentRound.guessData.lat - currentRound.photoLocation.lat) * 2 || 0.1,
                    longitudeDelta: Math.abs(currentRound.guessData.lon - currentRound.photoLocation.lon) * 2 || 0.1,
                  }}
                  onMapReady={fitMapToMarkers}
                >
                  {/* Guess Marker */}
                  <Marker
                    coordinate={{
                      latitude: currentRound.guessData.lat,
                      longitude: currentRound.guessData.lon,
                    }}
                    title="Your Guess"
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.guessMarker}>
                      <Ionicons name="location" size={16} color="#3b82f6" />
                    </View>
                  </Marker>

                  {/* Actual Location Marker */}
                  <Marker
                    coordinate={{
                      latitude: currentRound.photoLocation.lat,
                      longitude: currentRound.photoLocation.lon,
                    }}
                    title="Actual Location"
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.actualMarker}>
                      <Ionicons name="flag" size={16} color="#10b981" />
                    </View>
                  </Marker>

                  {/* Line between markers */}
                  <Polyline
                    coordinates={[
                      {
                        latitude: currentRound.guessData.lat,
                        longitude: currentRound.guessData.lon,
                      },
                      {
                        latitude: currentRound.photoLocation.lat,
                        longitude: currentRound.photoLocation.lon,
                      },
                    ]}
                    strokeColor="#ef4444"
                    strokeWidth={2}
                    lineDashPattern={[5, 5]}
                  />
                </MapView>

                {/* Distance Info */}
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate" size={20} color="#f59e0b" />
                  <Text style={styles.distanceText}>
                    {calculateDistance(
                      currentRound.guessData.lat,
                      currentRound.guessData.lon,
                      currentRound.photoLocation.lat,
                      currentRound.photoLocation.lon
                    ).toFixed(2)} km
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.mapContainer, styles.mapPlaceholder]}>
                <Ionicons name="map-outline" size={48} color="#64748b" />
                <Text style={styles.mapPlaceholderText}>Map not available</Text>
              </View>
            )}

            {/* Round Stats */}
            <View style={styles.roundStats}>
              <Text style={styles.roundStatsTitle}>Round Statistics</Text>
              <View style={styles.roundStatItem}>
                <Text style={styles.roundStatLabel}>Score</Text>
                <Text style={styles.roundStatValue}>{currentRound.score}</Text>
              </View>
              <View style={styles.roundStatItem}>
                <Text style={styles.roundStatLabel}>Normalized Score</Text>
                <Text style={styles.roundStatValue}>{currentRound.scoreNorm}/100</Text>
              </View>
              <View style={styles.roundStatItem}>
                <Text style={styles.roundStatLabel}>Time Taken</Text>
                <Text style={styles.roundStatValue}>
                  {calculateRoundDuration(currentRound.startTime, currentRound.endTime)}
                </Text>
              </View>
              {currentRound.hintsPurchased.length > 0 && (
                <View style={styles.roundStatItem}>
                  <Text style={styles.roundStatLabel}>Hints Used</Text>
                  <Text style={styles.roundStatValue}>{currentRound.hintsPurchased.length}</Text>
                </View>
              )}
            </View>

            {/* Photo Info if available */}
            {currentRound.photoMeta ? (
              <TouchableOpacity 
                style={styles.photoInfoSection}
                onPress={() => {
                  console.log('🎯 Navigating to PhotoDetails:', {
                    photoId: currentRound.photoId,
                    sessionId: sessionId,
                    roundIndex: selectedRound,
                  });
                  navigation.navigate('PhotoDetails', { 
                    photoId: currentRound.photoId,
                    sessionId: sessionId,
                    roundIndex: selectedRound,
                  });
                }}
                activeOpacity={0.8}
              >
                <View style={styles.photoInfoHeader}>
                  <Text style={styles.photoInfoTitle}>Photo Information</Text>
                  <Ionicons name="chevron-forward" size={24} color="#64748b" />
                </View>
                
                {currentRound.photoMeta.title && (
                  <View style={styles.photoInfoItem}>
                    <Text style={styles.photoInfoLabel}>Title</Text>
                    <Text style={styles.photoInfoValue}>{currentRound.photoMeta.title}</Text>
                  </View>
                )}
                
                <View style={styles.photoInfoRow}>
                  <View style={styles.photoInfoItemHalf}>
                    <Text style={styles.photoInfoLabel}>Difficulty</Text>
                    <Text style={[styles.photoInfoValue, styles.photoInfoBadge, 
                      currentRound.photoMeta.difficulty?.EASY !== undefined && styles.difficultyEasy,
                      currentRound.photoMeta.difficulty?.NORMAL !== undefined && styles.difficultyNormal,
                      currentRound.photoMeta.difficulty?.HARD !== undefined && styles.difficultyHard,
                      currentRound.photoMeta.difficulty?.EXTREME !== undefined && styles.difficultyExtreme,
                    ]}>
                      {Object.keys(currentRound.photoMeta.difficulty || {})[0] || 'Unknown'}
                    </Text>
                  </View>
                  
                  <View style={styles.photoInfoItemHalf}>
                    <Text style={styles.photoInfoLabel}>Scene Type</Text>
                    <Text style={[styles.photoInfoValue, styles.photoInfoBadge]}>
                      {Object.keys(currentRound.photoMeta.sceneKind || {})[0] || 'Unknown'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.photoInfoRow}>
                  <View style={styles.photoInfoItemHalf}>
                    <Text style={styles.photoInfoLabel}>Times Used</Text>
                    <Text style={styles.photoInfoValue}>
                      {Number(currentRound.photoMeta.timesUsed || 0).toLocaleString()}
                    </Text>
                  </View>
                  
                  <View style={styles.photoInfoItemHalf}>
                    <Text style={styles.photoInfoLabel}>Quality Score</Text>
                    <Text style={styles.photoInfoValue}>
                      {(currentRound.photoMeta.qualityScore || 0).toFixed(1)}/10
                    </Text>
                  </View>
                </View>
                
                {currentRound.photoMeta.region && (
                  <View style={styles.photoInfoItem}>
                    <Text style={styles.photoInfoLabel}>Location</Text>
                    <Text style={styles.photoInfoValue}>{currentRound.photoMeta.region}</Text>
                  </View>
                )}
                
                {currentRound.photoMeta.tags && currentRound.photoMeta.tags.length > 0 && (
                  <View style={styles.photoInfoItem}>
                    <Text style={styles.photoInfoLabel}>Tags</Text>
                    <View style={styles.tagsContainer}>
                      {currentRound.photoMeta.tags.map((tag: string, idx: number) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.photoInfoSection}>
                <Text style={styles.photoInfoTitle}>Loading photo information...</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    padding: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  },
  scrollContent: {
    paddingTop: 70, // Space for floating header
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  summaryTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 2,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  roundSelector: {
    marginBottom: 16,
  },
  roundSelectorContent: {
    paddingHorizontal: 16,
  },
  roundTab: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    minHeight: 80,
    justifyContent: 'center',
  },
  roundTabActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3b82f6',
  },
  roundTabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  roundTabTextActive: {
    color: '#3b82f6',
  },
  roundTabScore: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  roundTabScoreActive: {
    color: '#60a5fa',
  },
  roundTabTime: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  roundTabTimeActive: {
    color: '#93c5fd',
  },
  roundDetails: {
    paddingHorizontal: 16,
  },
  photoContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 250,
    backgroundColor: '#1e293b',
  },
  mapContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 350,
  },
  guessMarker: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  actualMarker: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  distanceInfo: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  roundStats: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  roundStatsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  roundStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  roundStatLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  roundStatValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPlaceholder: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  photoPlaceholderText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  mapPlaceholder: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  mapPlaceholderText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  photoInfoSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  photoInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoInfoTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoInfoItem: {
    marginBottom: 12,
  },
  photoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoInfoItemHalf: {
    flex: 0.48,
  },
  photoInfoLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  photoInfoValue: {
    color: '#ffffff',
    fontSize: 14,
  },
  photoInfoBadge: {
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyEasy: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
  difficultyNormal: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
  },
  difficultyHard: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
  },
  difficultyExtreme: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    color: '#a5b4fc',
    fontSize: 12,
  },
});