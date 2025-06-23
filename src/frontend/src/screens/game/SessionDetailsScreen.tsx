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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  
  // Debug selected round data
  useEffect(() => {
    if (rounds.length > 0 && rounds[selectedRound]) {
      console.log('🎯 Current selected round:', {
        round: selectedRound + 1,
        photoUrl: rounds[selectedRound].photoUrl?.substring(0, 100),
        hasGuessData: !!rounds[selectedRound].guessData,
        hasPhotoLocation: !!rounds[selectedRound].photoLocation,
      });
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
        
        // Process rounds and fetch photo data
        const roundsWithPhotos = await Promise.all(
          sessionResult.ok.rounds.map(async (round: any) => {
            // Convert BigInt to number for coordinates
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
            };
            
            return roundData;
          })
        );
        
        // Fetch all photo data in parallel for better performance
        console.log('🎯 Fetching photo data for all rounds in parallel...');
        const photoPromises = roundsWithPhotos.map(async (roundData, index) => {
          try {
            console.log('🎯 Fetching photo for round:', index + 1, 'photoId:', roundData.photoId);
            const photoMeta = await photoService.getPhotoMetadataV2(roundData.photoId);
            
            if (photoMeta) {
              console.log('🎯 Photo metadata found:', {
                id: photoMeta.id,
                title: photoMeta.title,
                uploadState: photoMeta.uploadState,
                status: photoMeta.status,
                lat: photoMeta.latitude,
                lon: photoMeta.longitude
              });
              
              // Set photo location
              roundData.photoLocation = {
                lat: photoMeta.latitude,
                lon: photoMeta.longitude,
              };
              
              // Check if photo is complete and active
              if (photoMeta.uploadState?.Complete !== undefined && photoMeta.status?.Active !== undefined) {
                // Get photo chunks for display (pass metadata to avoid duplicate fetch)
                const photoUrl = await photoService.getPhotoDataUrl(roundData.photoId, photoMeta);
                if (photoUrl) {
                  console.log('🎯 Photo URL generated for round:', index + 1);
                  roundData.photoUrl = photoUrl;
                } else {
                  console.warn('🎯 Failed to generate photo URL for round:', index + 1);
                }
              } else {
                console.warn('🎯 Photo not available:', {
                  uploadState: photoMeta.uploadState,
                  status: photoMeta.status
                });
              }
            } else {
              console.warn('🎯 No photo metadata found for photoId:', roundData.photoId);
            }
          } catch (error) {
            console.error('🎯 Failed to fetch photo data for round:', index + 1, error);
          }
        });
        
        // Wait for all photo fetches to complete
        await Promise.all(photoPromises);
        
        setRounds(roundsWithPhotos);
        
        // Debug: Log round data
        console.log('🎯 Rounds data processed:', roundsWithPhotos.map((r, i) => ({
          round: i + 1,
          hasPhoto: !!r.photoUrl,
          hasPhotoLocation: !!r.photoLocation,
          hasGuessData: !!r.guessData,
          photoLocation: r.photoLocation,
          guessData: r.guessData ? {
            lat: r.guessData.lat,
            lon: r.guessData.lon,
            confidenceRadius: r.guessData.confidenceRadius
          } : null,
          score: r.score
        })));
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
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
    
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  if (isLoading || (!session && sessionId)) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading session...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!session || rounds.length === 0) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Session Not Found</Text>
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const currentRound = rounds[selectedRound];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Details</Text>
          <View style={{ width: 24 }} />
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
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Round Details */}
          <View style={styles.roundDetails}>
            {/* Photo */}
            {currentRound.photoUrl && !imageErrors[currentRound.photoId] ? (
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
                  initialRegion={{
                    latitude: (currentRound.guessData.lat + currentRound.photoLocation.lat) / 2,
                    longitude: (currentRound.guessData.lon + currentRound.photoLocation.lon) / 2,
                    latitudeDelta: 0.1,
                    longitudeDelta: 0.1,
                  }}
                  onLayout={fitMapToMarkers}
                >
                  {/* Guess Marker */}
                  <Marker
                    coordinate={{
                      latitude: currentRound.guessData.lat,
                      longitude: currentRound.guessData.lon,
                    }}
                    title="Your Guess"
                  >
                    <View style={styles.guessMarker}>
                      <Ionicons name="location" size={24} color="#3b82f6" />
                    </View>
                  </Marker>

                  {/* Actual Location Marker */}
                  <Marker
                    coordinate={{
                      latitude: currentRound.photoLocation.lat,
                      longitude: currentRound.photoLocation.lon,
                    }}
                    title="Actual Location"
                  >
                    <View style={styles.actualMarker}>
                      <Ionicons name="flag" size={24} color="#10b981" />
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
              <View style={styles.roundStatItem}>
                <Text style={styles.roundStatLabel}>Score</Text>
                <Text style={styles.roundStatValue}>{currentRound.score}</Text>
              </View>
              <View style={styles.roundStatItem}>
                <Text style={styles.roundStatLabel}>Normalized Score</Text>
                <Text style={styles.roundStatValue}>{currentRound.scoreNorm}/100</Text>
              </View>
              {currentRound.hintsPurchased.length > 0 && (
                <View style={styles.roundStatItem}>
                  <Text style={styles.roundStatLabel}>Hints Used</Text>
                  <Text style={styles.roundStatValue}>{currentRound.hintsPurchased.length}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
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
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
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
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  roundSelector: {
    marginBottom: 20,
  },
  roundSelectorContent: {
    paddingHorizontal: 20,
  },
  roundTab: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
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
  roundDetails: {
    paddingHorizontal: 20,
  },
  photoContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: '#1e293b',
  },
  mapContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 300,
  },
  guessMarker: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  actualMarker: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 20,
    padding: 8,
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
});