import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Ionicons, 
  MaterialCommunityIcons, 
  FontAwesome5,
  MaterialIcons 
} from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { photoServiceV2 } from '../../services/photoV2';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';
import { useGameStore } from '../../store/gameStore';
import { useFocusEffect } from '@react-navigation/native';

export default function GameModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Game'>>();
  const [selectedDifficulty, setSelectedDifficulty] = useState('NORMAL');
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [weeklyPhotoCount, setWeeklyPhotoCount] = useState<number | null>(null);
  const [isCheckingPhotos, setIsCheckingPhotos] = useState(false);
  const [isProMember, setIsProMember] = useState(false);
  const { identity } = useAuth();
  const { resetGame, sessionId, sessionStatus } = useGameStore();

  // Reset game state when screen gains focus to ensure fresh start
  useFocusEffect(
    React.useCallback(() => {
      // Only reset game state if there's a completed or abandoned session
      // Don't reset if there's an active session that should continue
      if (sessionStatus === 'Completed' || sessionStatus === 'Abandoned') {
        console.log('🎮 Resetting completed/abandoned game session on GameModeScreen focus');
        resetGame();
      }
    }, [sessionStatus, resetGame])
  );

  // Check photo count and Pro membership on component mount
  useEffect(() => {
    const checkPhotoCountAndPro = async () => {
      if (!identity) return;
      
      setIsCheckingPhotos(true);
      try {
        // Initialize services
        await photoServiceV2.init(identity);
        await gameService.init(identity);
        
        // Check Pro membership status
        const proStatus = await gameService.getProMembershipStatus();
        console.log('🎮 Pro membership status:', proStatus);
        if (proStatus) {
          setIsProMember(proStatus.isPro);
        }
        
        // Check photo count
        const result = await photoServiceV2.searchPhotos({
          status: { Active: null }
        }, undefined, 10);
        
        // searchPhotos returns SearchResult directly (not wrapped in Result)
        setPhotoCount(result.photos.length);
        
        // Calculate weekly photos (photos uploaded in the last 7 days)
        const oneWeekAgo = Date.now() * 1000000 - (7 * 24 * 60 * 60 * 1000000000); // nanoseconds
        const weeklyPhotos = result.photos.filter(photo => 
          Number(photo.createdAt) >= oneWeekAgo
        );
        
        console.log('🎮 Weekly photos check:', {
          currentTime: Date.now() * 1000000,
          oneWeekAgo,
          photoCreatedTimes: result.photos.map(p => Number(p.createdAt)),
          weeklyCount: weeklyPhotos.length
        });
        
        setWeeklyPhotoCount(weeklyPhotos.length);
        
      } catch (error) {
        console.error('Error checking photo count and Pro status:', error);
        setPhotoCount(0);
        setWeeklyPhotoCount(0);
      } finally {
        setIsCheckingPhotos(false);
      }
    };

    checkPhotoCountAndPro();
  }, [identity]);

  const startGamePlay = (difficulty: string, mode: string = 'classic') => {
    // Check Pro membership for This Week's Photos mode
    if (mode === 'thisweek' && !isProMember) {
      Alert.alert(
        'Pro Membership Required',
        "This Week's Photos mode is exclusive to Pro members. Upgrade to Pro to access this feature!",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => navigation.navigate('Profile') }
        ]
      );
      return;
    }
    
    // Check if we have enough photos
    if (mode === 'classic' && photoCount !== null && photoCount < 5) {
      Alert.alert(
        'Insufficient Photos',
        `We need at least 5 photos to start a game, but only ${photoCount} photos are available. Please try again later when more photos have been uploaded.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (mode === 'thisweek' && weeklyPhotoCount !== null && weeklyPhotoCount < 5) {
      Alert.alert(
        'Insufficient Weekly Photos',
        `We need at least 5 photos from this week to start, but only ${weeklyPhotoCount} are available. Please try again later when more photos have been uploaded.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to region selection for both classic and thisweek modes
    navigation.navigate('RegionSelect', { gameMode: mode });
  };

  const gameModes = useMemo(() => [
    {
      title: 'Classic Mode',
      description: 'Guess the location from a single photo',
      icon: 'earth' as const,
      gradient: ['#3b82f6', '#2563eb'] as const,
      available: photoCount === null || photoCount >= 5,
      difficulty: 'NORMAL',
      mode: 'classic',
    },
    {
      title: "This Week's Photos",
      description: 'Play with photos from the last 7 days',
      icon: 'calendar' as const,
      gradient: ['#10b981', '#059669'] as const,
      available: isProMember && (weeklyPhotoCount === null || weeklyPhotoCount >= 5),
      difficulty: 'NORMAL',
      mode: 'thisweek',
      requiresPro: true,
    },
    {
      title: 'Speed Mode',
      description: 'Race against time with multiple photos',
      icon: 'speed' as const,
      gradient: ['#f59e0b', '#d97706'] as const,
      available: false,
      difficulty: 'HARD',
      mode: 'speed',
    },
    {
      title: 'Multiplayer',
      description: 'Compete with other players in real-time',
      icon: 'people' as const,
      gradient: ['#8b5cf6', '#7c3aed'] as const,
      available: false,
      difficulty: 'EXTREME',
      mode: 'multiplayer',
    },
  ], [isProMember, photoCount, weeklyPhotoCount]);

  const difficultyLevels = [
    {
      name: 'EASY',
      label: 'Easy',
      description: '5 min timer • More hints',
      icon: 'happy-outline' as const,
      color: '#10b981',
      multiplier: '0.8x',
    },
    {
      name: 'NORMAL',
      label: 'Normal',
      description: '3 min timer • Standard hints',
      icon: 'flash' as const,
      color: '#3b82f6',
      multiplier: '1.0x',
    },
    {
      name: 'HARD',
      label: 'Hard',
      description: '2 min timer • Limited hints',
      icon: 'flame' as const,
      color: '#f59e0b',
      multiplier: '1.5x',
    },
    {
      name: 'EXTREME',
      label: 'Extreme',
      description: '1 min timer • No hints',
      icon: 'skull' as const,
      color: '#ef4444',
      multiplier: '2.0x',
    },
  ];

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Challenge</Text>
            <Text style={styles.subtitle}>
              Select a game mode and test your geography skills
            </Text>
            
            {/* Photo Status Indicator */}
            <View style={styles.photoStatusContainer}>
              {isCheckingPhotos ? (
                <View style={styles.photoStatusLoading}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.photoStatusText}>Checking available photos...</Text>
                </View>
              ) : photoCount !== null ? (
                <View style={[
                  styles.photoStatusBadge,
                  photoCount >= 5 ? styles.photoStatusSuccess : styles.photoStatusWarning
                ]}>
                  <Ionicons 
                    name={photoCount >= 5 ? "checkmark-circle" : "warning"} 
                    size={16} 
                    color={photoCount >= 5 ? "#10b981" : "#f59e0b"} 
                  />
                  <Text style={[
                    styles.photoStatusText,
                    { color: photoCount >= 5 ? "#10b981" : "#f59e0b" }
                  ]}>
                    {photoCount >= 5 
                      ? `${photoCount} photos available - Ready to play!`
                      : `Only ${photoCount} photos available - Need ${5 - photoCount} more`
                    }
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Game Modes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Modes</Text>
            {gameModes.map((mode) => (
              <TouchableOpacity
                key={mode.title}
                style={[styles.modeCard, !mode.available && styles.modeCardDisabled]}
                onPress={() => mode.available && startGamePlay(selectedDifficulty, mode.mode)}
                disabled={!mode.available}
                activeOpacity={mode.available ? 0.8 : 1}
              >
                <LinearGradient
                  colors={mode.available ? mode.gradient : ['#475569', '#334155']}
                  style={styles.modeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.modeIconContainer}>
                    {mode.icon === 'earth' ? (
                      <MaterialCommunityIcons name="earth" size={32} color="#ffffff" />
                    ) : mode.icon === 'calendar' ? (
                      <Ionicons name="calendar" size={32} color="#ffffff" />
                    ) : mode.icon === 'speed' ? (
                      <MaterialIcons name="speed" size={32} color="#ffffff" />
                    ) : (
                      <Ionicons name="people" size={32} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.modeTextContainer}>
                    <View style={styles.modeTitleRow}>
                      <Text style={styles.modeTitle}>{mode.title}</Text>
                      {!mode.available && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>
                            {'requiresPro' in mode && mode.requiresPro && !isProMember ? 'PRO' : 'COMING SOON'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modeDescription}>{mode.description}</Text>
                  </View>
                  {mode.available && (
                    <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Difficulty Level</Text>
            <View style={styles.difficultyContainer}>
              {difficultyLevels.map((level) => (
                <TouchableOpacity
                  key={level.name}
                  style={[
                    styles.difficultyItem,
                    selectedDifficulty === level.name && styles.difficultyItemSelected
                  ]}
                  onPress={() => setSelectedDifficulty(level.name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.difficultyIcon, { backgroundColor: `${level.color}20` }]}>
                    {level.icon === 'flame' ? (
                      <FontAwesome5 name="fire" size={18} color={level.color} />
                    ) : level.icon === 'skull' ? (
                      <MaterialCommunityIcons name="skull" size={20} color={level.color} />
                    ) : level.icon === 'happy-outline' ? (
                      <Ionicons name="happy-outline" size={20} color={level.color} />
                    ) : (
                      <Ionicons name="flash" size={20} color={level.color} />
                    )}
                  </View>
                  <View style={styles.difficultyTextContainer}>
                    <View style={styles.difficultyLabelRow}>
                      <Text style={styles.difficultyLabel}>{level.label}</Text>
                      <View style={[styles.multiplierBadge, { backgroundColor: `${level.color}20` }]}>
                        <Text style={[styles.multiplierText, { color: level.color }]}>
                          {level.multiplier}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.difficultyDescription}>{level.description}</Text>
                  </View>
                  {selectedDifficulty === level.name && (
                    <Ionicons name="checkmark-circle" size={24} color={level.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => startGamePlay(selectedDifficulty)}
              activeOpacity={0.8}
              style={styles.startButton}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.startButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="play" size={24} color="#ffffff" />
                <Text style={styles.startButtonText}>Start Classic Mode</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color="#3b82f6" />
              <View style={styles.tipTextContainer}>
                <Text style={styles.tipTitle}>Pro Tip</Text>
                <Text style={styles.tipText}>
                  Look for unique landmarks, vegetation patterns, and architectural styles to narrow down the location.
                </Text>
              </View>
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
  scrollContent: {
    paddingBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44, // iPhone's status bar height
    paddingBottom: 16,
    gap: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  photoStatusContainer: {
    marginTop: 16,
  },
  photoStatusLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  photoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoStatusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  photoStatusWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  photoStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modeCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modeCardDisabled: {
    opacity: 0.5,
  },
  modeGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  comingSoonBadge: {
    marginLeft: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modeDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  difficultyContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  difficultyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  difficultyItemSelected: {
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
  },
  difficultyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  difficultyTextContainer: {
    flex: 1,
  },
  difficultyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  difficultyLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  multiplierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  difficultyDescription: {
    color: '#94a3b8',
    fontSize: 14,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  startButtonGradient: {
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  tipsContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  tipCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  tipTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  tipTitle: {
    color: '#3b82f6',
    fontWeight: '600',
    marginBottom: 4,
  },
  tipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});