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

  useEffect(() => {
    if (photoId && identity) {
      fetchPhotoDetails();
      checkVoteStatus();
    }
  }, [photoId, identity]);

  const fetchPhotoDetails = async () => {
    try {
      // Initialize services
      await photoService.init(identity!);
      
      // Get photo metadata
      const metadata = await photoService.getPhotoMetadataV2(photoId);
      if (metadata) {
        setPhotoMeta(metadata);
        
        // Get photo URL
        if (metadata.uploadState?.Complete !== undefined && metadata.status?.Active !== undefined) {
          const url = await photoService.getPhotoDataUrl(photoId, metadata);
          setPhotoUrl(url);
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
    // TODO: Check if user has already voted for this photo in this round
    // For now, we'll use local storage or session data
    if (sessionId && roundIndex !== undefined) {
      const voteKey = `vote_${sessionId}_${roundIndex}`;
      // This is a placeholder - in real implementation, check from backend
      const hasVotedForRound = false; // Check from backend or local state
      setHasVoted(hasVotedForRound);
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

    setIsVoting(true);
    try {
      // TODO: Implement actual voting API call
      console.log('Voting for photo:', photoId, 'with ratings:', ratings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update vote status
      setHasVoted(true);
      
      Alert.alert('Success', 'Thank you for rating this photo!');
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
                <Text style={styles.statLabel}>Times Used</Text>
                <Text style={styles.statValue}>
                  {Number(photoMeta.timesUsed || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Quality Score</Text>
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
          </View>

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
});