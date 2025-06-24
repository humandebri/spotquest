import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { photoService } from '../../services/photo';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';

type PhotoDetailsRouteProp = RouteProp<RootStackParamList, 'PhotoDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PhotoDetails'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PhotoDetailsScreen() {
  const route = useRoute<PhotoDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { photoId, sessionId, roundIndex } = route.params;
  const { identity, principal } = useAuth();

  const [photoMeta, setPhotoMeta] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [ratings, setRatings] = useState({
    difficulty: 0,
    interest: 0,
    beauty: 0,
  });
  const [existingRatings, setExistingRatings] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userRatingStats, setUserRatingStats] = useState<any>(null);
  const [photoStats, setPhotoStats] = useState<any>(null);
  const [photoEloRating, setPhotoEloRating] = useState<number>(1500);

  useEffect(() => {
    if (photoId && identity) {
      fetchPhotoDetails();
      checkVoteStatus();
      fetchUserStats();
    }
  }, [photoId, identity]);

  const fetchPhotoDetails = async () => {
    try {
      // Initialize services
      await photoService.init(identity!);
      await gameService.init(identity!);
      
      // Get photo metadata
      const metadata = await photoService.getPhotoMetadataV2(photoId);
      if (metadata) {
        setPhotoMeta(metadata);
        
        // Get photo URL
        if (metadata.uploadState?.Complete !== undefined && metadata.status?.Active !== undefined) {
          const url = await photoService.getPhotoDataUrl(photoId, metadata);
          setPhotoUrl(url);
        }
        
        // Get existing ratings if available
        const photoRatings = await gameService.getPhotoRatings(photoId);
        if (photoRatings) {
          setExistingRatings(photoRatings);
        }
        
        // Get photo Elo rating
        const eloRating = await gameService.getPhotoEloRating(photoId);
        setPhotoEloRating(eloRating);
        
        // Get photo stats
        const stats = await gameService.getPhotoStatsById(photoId);
        if (stats) {
          setPhotoStats(stats);
        }
      }
    } catch (error) {
      console.error('Failed to fetch photo details:', error);
      Alert.alert('Error', 'Failed to load photo details');
    } finally {
      setIsLoading(false);
    }
  };

  const checkVoteStatus = async () => {
    // Check if user has already voted for this photo in this session
    if (sessionId && roundIndex !== undefined && identity) {
      try {
        await gameService.init(identity);
        const canRate = await gameService.canRatePhoto(sessionId, photoId);
        setHasVoted(!canRate);
      } catch (error) {
        console.error('Failed to check vote status:', error);
        // Default to allowing vote on error
        setHasVoted(false);
      }
    }
  };

  const fetchUserStats = async () => {
    if (!identity) return;
    
    try {
      await gameService.init(identity);
      
      // Fetch player stats
      const playerStats = await gameService.getPlayerStats();
      if (playerStats) {
        setUserStats(playerStats);
      }
      
      // Fetch user rating stats
      const ratingStats = await gameService.getUserRatingStats();
      if (ratingStats) {
        setUserRatingStats(ratingStats);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const handleRatingChange = (category: 'difficulty' | 'interest' | 'beauty', rating: number) => {
    if (hasVoted) return;
    
    setRatings(prev => ({
      ...prev,
      [category]: rating,
    }));
  };

  const handleSubmitVote = async () => {
    if (hasVoted || isVoting) return;
    
    // Check if all ratings are provided
    if (ratings.difficulty === 0 || ratings.interest === 0 || ratings.beauty === 0) {
      Alert.alert('Incomplete Rating', 'Please rate all three categories before submitting');
      return;
    }

    // Check if we have session context
    if (!sessionId || roundIndex === undefined) {
      Alert.alert('Error', 'Rating is only available when playing the game.');
      return;
    }

    setIsVoting(true);
    try {
      console.log('Voting for photo:', photoId, 'with ratings:', ratings);
      
      const result = await gameService.submitPhotoRating(
        sessionId,
        photoId,
        roundIndex,
        ratings
      );
      
      if (result.ok) {
        setHasVoted(true);
        Alert.alert('Success', 'Thank you for rating this photo!');
        
        // Refresh ratings
        const updatedRatings = await gameService.getPhotoRatings(photoId);
        if (updatedRatings) {
          setExistingRatings(updatedRatings);
        }
      } else {
        // Handle specific error messages
        let errorMessage = result.err || 'Failed to submit your vote';
        if (result.err?.includes('Cannot rate your own photo')) {
          errorMessage = 'You cannot rate your own photo';
        } else if (result.err?.includes('Anonymous users cannot rate')) {
          errorMessage = 'Please sign in to rate photos';
        } else if (result.err?.includes('Photo not found')) {
          errorMessage = 'This photo no longer exists';
        } else if (result.err?.includes('Rate limit exceeded')) {
          errorMessage = 'You have rated too many photos recently. Please try again later.';
        }
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Failed to submit vote:', error);
      Alert.alert('Error', 'Failed to submit your vote');
    } finally {
      setIsVoting(false);
    }
  };

  const renderRatingStars = (category: 'difficulty' | 'interest' | 'beauty') => {
    const stars = [];
    const currentRating = ratings[category];
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleRatingChange(category, i)}
          disabled={hasVoted}
          style={styles.starButton}
        >
          <Ionicons
            name={i <= currentRating ? "star" : "star-outline"}
            size={32}
            color={hasVoted ? "#64748b" : "#f59e0b"}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingLabel = (category: 'difficulty' | 'interest' | 'beauty', rating: number) => {
    const labels = {
      difficulty: ['', 'Very Easy', 'Easy', 'Normal', 'Hard', 'Very Hard'],
      interest: ['', 'Boring', 'Somewhat Boring', 'OK', 'Interesting', 'Very Interesting'],
      beauty: ['', 'Poor', 'Below Average', 'Average', 'Beautiful', 'Stunning'],
    };
    return labels[category][rating] || '';
  };

  const formatDuration = (nanoseconds: number): string => {
    const milliseconds = nanoseconds / 1_000_000;
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading photo details...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!photoMeta) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Photo not found</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Photo */}
          {photoUrl ? (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={[styles.photoContainer, styles.photoPlaceholder]}>
              <Ionicons name="image-outline" size={48} color="#64748b" />
              <Text style={styles.photoPlaceholderText}>Photo not available</Text>
            </View>
          )}

          {/* Title and Basic Info */}
          <View style={styles.infoCard}>
            <Text style={styles.title}>{photoMeta.title || 'Untitled Photo'}</Text>
            {photoMeta.description && (
              <Text style={styles.description}>{photoMeta.description}</Text>
            )}

            <View style={styles.badgeRow}>
              <View style={[styles.badge, 
                photoMeta.difficulty?.EASY !== undefined && styles.difficultyEasy,
                photoMeta.difficulty?.NORMAL !== undefined && styles.difficultyNormal,
                photoMeta.difficulty?.HARD !== undefined && styles.difficultyHard,
                photoMeta.difficulty?.EXTREME !== undefined && styles.difficultyExtreme,
              ]}>
                <Text style={styles.badgeText}>
                  {Object.keys(photoMeta.difficulty || {})[0] || 'Unknown'}
                </Text>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {Object.keys(photoMeta.sceneKind || {})[0] || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Elo Rating</Text>
                <Text style={[styles.statValue, { color: '#3b82f6' }]}>
                  {photoEloRating}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Avg Score</Text>
                <Text style={styles.statValue}>
                  {photoStats ? photoStats.averageScore.toFixed(0) : '-'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Times Played</Text>
                <Text style={styles.statValue}>
                  {photoStats ? photoStats.playCount.toLocaleString() : '0'}
                </Text>
              </View>
            </View>
            
            {/* Additional Stats Row */}
            <View style={[styles.statsGrid, { marginTop: 12 }]}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Best Score</Text>
                <Text style={styles.statValue}>
                  {photoStats ? photoStats.bestScore.toLocaleString() : '-'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Quality</Text>
                <Text style={styles.statValue}>
                  {(photoMeta.qualityScore || 0).toFixed(1)}/10
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Upload Date</Text>
                <Text style={styles.statValue}>
                  {new Date(Number(photoMeta.uploadTime) / 1000000).toLocaleDateString()}
                </Text>
              </View>
            </View>
            
            {/* Display aggregated ratings if available */}
            {existingRatings && (
              <View style={styles.aggregatedRatings}>
                <Text style={styles.aggregatedTitle}>Community Ratings</Text>
                <View style={styles.aggregatedGrid}>
                  <View style={styles.aggregatedItem}>
                    <Text style={styles.aggregatedLabel}>Difficulty</Text>
                    <View style={styles.aggregatedStars}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(existingRatings.difficulty.average) ? "star" : "star-outline"}
                          size={14}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                    <Text style={styles.aggregatedCount}>
                      ({Number(existingRatings.difficulty.count)} votes)
                    </Text>
                  </View>
                  <View style={styles.aggregatedItem}>
                    <Text style={styles.aggregatedLabel}>Interest</Text>
                    <View style={styles.aggregatedStars}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(existingRatings.interest.average) ? "star" : "star-outline"}
                          size={14}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                    <Text style={styles.aggregatedCount}>
                      ({Number(existingRatings.interest.count)} votes)
                    </Text>
                  </View>
                  <View style={styles.aggregatedItem}>
                    <Text style={styles.aggregatedLabel}>Beauty</Text>
                    <View style={styles.aggregatedStars}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <Ionicons
                          key={i}
                          name={i <= Math.round(existingRatings.beauty.average) ? "star" : "star-outline"}
                          size={14}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                    <Text style={styles.aggregatedCount}>
                      ({Number(existingRatings.beauty.count)} votes)
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* User Statistics Section */}
          {(userStats || userRatingStats) && (
            <View style={styles.userStatsCard}>
              <Text style={styles.sectionTitle}>Your Statistics</Text>
              
              {/* Game Stats */}
              {userStats && (
                <View style={styles.userStatsSection}>
                  <Text style={styles.userStatsSubtitle}>Game Performance</Text>
                  <View style={styles.userStatsGrid}>
                    <View style={styles.userStatItem}>
                      <Text style={styles.userStatLabel}>Avg Score</Text>
                      <Text style={styles.userStatValue}>
                        {userStats.averageScore.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.userStatItem}>
                      <Text style={styles.userStatLabel}>Avg Play Time</Text>
                      <Text style={styles.userStatValue}>
                        {formatDuration(userStats.averageDuration)}
                      </Text>
                    </View>
                    <View style={styles.userStatItem}>
                      <Text style={styles.userStatLabel}>Games Played</Text>
                      <Text style={styles.userStatValue}>
                        {userStats.totalGamesPlayed}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Rating Stats */}
              {userRatingStats && userRatingStats.totalRatings > 0 && (
                <View style={styles.userStatsSection}>
                  <Text style={styles.userStatsSubtitle}>Your Average Ratings</Text>
                  <View style={styles.userRatingStatsGrid}>
                    <View style={styles.userRatingStatItem}>
                      <Text style={styles.userStatLabel}>Difficulty</Text>
                      <View style={styles.userRatingStars}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Ionicons
                            key={i}
                            name={i <= Math.round(userRatingStats.averageDifficulty) ? "star" : "star-outline"}
                            size={12}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                      <Text style={styles.userRatingValue}>
                        {userRatingStats.averageDifficulty.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.userRatingStatItem}>
                      <Text style={styles.userStatLabel}>Interest</Text>
                      <View style={styles.userRatingStars}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Ionicons
                            key={i}
                            name={i <= Math.round(userRatingStats.averageInterest) ? "star" : "star-outline"}
                            size={12}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                      <Text style={styles.userRatingValue}>
                        {userRatingStats.averageInterest.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.userRatingStatItem}>
                      <Text style={styles.userStatLabel}>Beauty</Text>
                      <View style={styles.userRatingStars}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Ionicons
                            key={i}
                            name={i <= Math.round(userRatingStats.averageBeauty) ? "star" : "star-outline"}
                            size={12}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                      <Text style={styles.userRatingValue}>
                        {userRatingStats.averageBeauty.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.userRatingCount}>
                    Based on {userRatingStats.totalRatings} ratings
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Rating Section */}
          <View style={styles.ratingCard}>
            <Text style={styles.sectionTitle}>Rate This Photo</Text>
            {hasVoted ? (
              <View style={styles.votedContainer}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.votedText}>Thank you for rating!</Text>
                <Text style={styles.votedSubtext}>You can only vote once per round</Text>
                <View style={styles.votedRatings}>
                  <Text style={styles.votedRatingItem}>Difficulty: {getRatingLabel('difficulty', ratings.difficulty)}</Text>
                  <Text style={styles.votedRatingItem}>Interest: {getRatingLabel('interest', ratings.interest)}</Text>
                  <Text style={styles.votedRatingItem}>Beauty: {getRatingLabel('beauty', ratings.beauty)}</Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.ratingPrompt}>Please rate this photo in three categories:</Text>
                
                {/* Difficulty Rating */}
                <View style={styles.ratingCategory}>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.ratingCategoryTitle}>Difficulty</Text>
                    <Text style={styles.ratingLabel}>{getRatingLabel('difficulty', ratings.difficulty)}</Text>
                  </View>
                  <Text style={styles.ratingDescription}>How hard was it to guess this location?</Text>
                  <View style={styles.starsContainer}>
                    {renderRatingStars('difficulty')}
                  </View>
                </View>

                {/* Interest Rating */}
                <View style={styles.ratingCategory}>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.ratingCategoryTitle}>Interest / Fun</Text>
                    <Text style={styles.ratingLabel}>{getRatingLabel('interest', ratings.interest)}</Text>
                  </View>
                  <Text style={styles.ratingDescription}>How interesting or fun was this photo?</Text>
                  <View style={styles.starsContainer}>
                    {renderRatingStars('interest')}
                  </View>
                </View>

                {/* Beauty Rating */}
                <View style={styles.ratingCategory}>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.ratingCategoryTitle}>Scenery / Beauty</Text>
                    <Text style={styles.ratingLabel}>{getRatingLabel('beauty', ratings.beauty)}</Text>
                  </View>
                  <Text style={styles.ratingDescription}>How beautiful is this location?</Text>
                  <View style={styles.starsContainer}>
                    {renderRatingStars('beauty')}
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, 
                    (ratings.difficulty === 0 || ratings.interest === 0 || ratings.beauty === 0) && styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmitVote}
                  disabled={isVoting || ratings.difficulty === 0 || ratings.interest === 0 || ratings.beauty === 0}
                >
                  {isVoting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Rating</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Location Map */}
          <View style={styles.mapCard}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: photoMeta.latitude,
                  longitude: photoMeta.longitude,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: photoMeta.latitude,
                    longitude: photoMeta.longitude,
                  }}
                >
                  <View style={styles.mapMarker}>
                    <Ionicons name="location" size={20} color="#ef4444" />
                  </View>
                </Marker>
              </MapView>
              <Text style={styles.locationText}>{photoMeta.region || 'Unknown Location'}</Text>
            </View>
          </View>

          {/* Tags */}
          {photoMeta.tags && photoMeta.tags.length > 0 && (
            <View style={styles.tagsCard}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {photoMeta.tags.map((tag: string, idx: number) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Hint (if in game context) */}
          {sessionId && photoMeta.hint && (
            <View style={styles.hintCard}>
              <Text style={styles.sectionTitle}>Hint</Text>
              <Text style={styles.hintText}>{photoMeta.hint}</Text>
            </View>
          )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 18,
  },
  scrollContent: {
    paddingTop: 70,
    paddingBottom: 20,
  },
  photoContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 300,
    backgroundColor: '#1e293b',
  },
  photoPlaceholder: {
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  photoPlaceholderText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  difficultyEasy: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  difficultyNormal: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  difficultyHard: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  difficultyExtreme: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  ratingPrompt: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  ratingCategory: {
    marginBottom: 24,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingCategoryTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingLabel: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  ratingDescription: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  starButton: {
    padding: 4,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  votedContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  votedText: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 12,
  },
  votedSubtext: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 16,
  },
  votedRatings: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  votedRatingItem: {
    color: '#10b981',
    fontSize: 14,
    marginVertical: 4,
  },
  mapCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: 150,
  },
  mapMarker: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  locationText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  tagsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    color: '#a5b4fc',
    fontSize: 14,
  },
  hintCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  hintText: {
    color: '#fbbf24',
    fontSize: 14,
    lineHeight: 20,
  },
  aggregatedRatings: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)',
  },
  aggregatedTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  aggregatedGrid: {
    gap: 12,
  },
  aggregatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aggregatedLabel: {
    color: '#94a3b8',
    fontSize: 14,
    flex: 1,
  },
  aggregatedStars: {
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: 8,
  },
  aggregatedCount: {
    color: '#64748b',
    fontSize: 12,
  },
  userStatsCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  userStatsSection: {
    marginBottom: 20,
  },
  userStatsSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  userStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  userStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  userStatLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  userStatValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  userRatingStatsGrid: {
    gap: 12,
  },
  userRatingStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRatingStars: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
    justifyContent: 'center',
  },
  userRatingValue: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  userRatingCount: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});