import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  Feather,
  Foundation
} from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { photoServiceV2, PhotoMetaV2 } from '../../services/photoV2';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { abbreviateLocationName } from '../../utils/regionMapping';

// Use V2 types
type PhotoMetadata = PhotoMetaV2;
import { gameService } from '../../services/game';
import { CustomPrincipal } from '../../utils/principal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface UserStats {
  totalGamesPlayed: number;
  totalPhotosUploaded: number;
  totalRewardsEarned: number;
  bestScore: number;
  averageScore: number;
  averageScore30Days?: number;
  rank?: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
}

// Helper function to extract difficulty from V2 variant
const getDifficulty = (diff: any): 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME' => {
  if (!diff || typeof diff !== 'object') {
    console.warn('Invalid difficulty value:', diff);
    return 'NORMAL';
  }

  // Check for variant properties (e.g., { EASY: null })
  if ('EASY' in diff) return 'EASY';
  if ('NORMAL' in diff) return 'NORMAL';
  if ('HARD' in diff) return 'HARD';
  if ('EXTREME' in diff) return 'EXTREME';

  console.warn('Unknown difficulty variant:', diff);
  return 'NORMAL';
};

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { principal, logout, identity } = useAuth();

  // Early return if not authenticated
  if (!principal || !identity) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={{ color: '#fff', marginTop: 16 }}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const [currentTab, setCurrentTab] = useState<'stats' | 'photos' | 'achievements'>('stats');
  const [isServiceInitialized, setIsServiceInitialized] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Username state
  const [username, setUsername] = useState('Anonymous User');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');

  // Token balance state
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Pro membership state
  const [isProMember, setIsProMember] = useState(false);
  const [proExpiryDate, setProExpiryDate] = useState<Date | null>(null);

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [stats, setStats] = useState<UserStats>({
    totalGamesPlayed: 0,
    totalPhotosUploaded: 0,
    totalRewardsEarned: 0,
    bestScore: 0,
    averageScore: 0,
    averageScore30Days: 0,
    rank: undefined,
    winRate: 0,
    currentStreak: 0,
    longestStreak: 0,
  });

  // Photo management state
  const [userPhotos, setUserPhotos] = useState<PhotoMetadata[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
    hint: string;
    tags: string[];
  }>({
    title: '',
    description: '',
    difficulty: 'NORMAL',
    hint: '',
    tags: [],
  });

  // Load username from storage
  const loadUsername = useCallback(async () => {
    if (principal) {
      try {
        const savedUsername = await AsyncStorage.getItem(`username_${principal.toString()}`);
        if (savedUsername) {
          setUsername(savedUsername);
        }
      } catch (error) {
        console.error('Failed to load username:', error);
      }
    }
  }, [principal]);

  // Save username to storage and backend
  const saveUsername = useCallback(async (newUsername: string) => {
    if (principal && newUsername.trim()) {
      try {
        // Save to local storage first
        await AsyncStorage.setItem(`username_${principal.toString()}`, newUsername.trim());
        setUsername(newUsername.trim());
        
        // Save to backend
        if (isServiceInitialized) {
          const result = await gameService.setUsername(newUsername.trim());
          if (result.err) {
            console.error('Failed to save username to backend:', result.err);
            Alert.alert('Warning', 'Username saved locally but failed to save to server: ' + result.err);
          } else {
            console.log('Username saved to backend successfully');
          }
        }
      } catch (error) {
        console.error('Failed to save username:', error);
        Alert.alert('Error', 'Failed to save username');
      }
    }
  }, [principal, isServiceInitialized]);

  // Load token balance
  const loadTokenBalance = useCallback(async () => {
    if (!principal || !isServiceInitialized) return;

    setIsLoadingBalance(true);
    try {
      const balance = await gameService.getTokenBalance(CustomPrincipal.fromText(principal.toString()));
      setTokenBalance(balance);
    } catch (error) {
      console.error('Failed to load token balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [principal, isServiceInitialized]);

  // Initialize game service
  React.useEffect(() => {
    const initService = async () => {
      if (identity && !gameService.isInitialized) {
        try {
          console.log('🏠 Initializing game service...');
          await gameService.init(identity);
          console.log('🏠 Game service initialized successfully');
          setIsServiceInitialized(true);
        } catch (error) {
          console.error('Failed to initialize game service:', error);
          setIsServiceInitialized(false);
        }
      } else if (identity && gameService.isInitialized) {
        // Service already initialized
        setIsServiceInitialized(true);
      }
    };
    initService();
  }, [identity]);

  // Load username when principal is available
  React.useEffect(() => {
    loadUsername();
  }, [loadUsername]);

  // Load token balance when service is initialized
  React.useEffect(() => {
    if (isServiceInitialized) {
      loadTokenBalance();
      
      // Sync username to backend if we have one locally
      const syncUsername = async () => {
        if (principal && username && username !== 'Anonymous User') {
          const backendUsername = await gameService.getUsername(CustomPrincipal.fromText(principal.toString()));
          if (!backendUsername) {
            // Username exists locally but not on backend - sync it
            const result = await gameService.setUsername(username);
            if (result.ok !== undefined) {
              console.log('Username synced to backend');
            }
          }
        }
      };
      
      syncUsername();
    }
  }, [isServiceInitialized, loadTokenBalance, principal, username]);

  // Load player stats
  const loadPlayerStats = React.useCallback(async () => {
    if (!principal || !isServiceInitialized || !gameService.isInitialized) {
      console.log('🏠 loadPlayerStats skipped - principal:', !!principal, 
        'isServiceInitialized:', isServiceInitialized, 
        'gameService.isInitialized:', gameService.isInitialized);
      return;
    }

    setIsLoadingStats(true);
    try {
      console.log('🏠 Loading player stats for principal:', principal.toString());
      const playerStats = await gameService.getPlayerStats(CustomPrincipal.fromText(principal.toString()));
      if (playerStats) {
        setStats({
          totalGamesPlayed: Number(playerStats.totalGamesPlayed),
          totalPhotosUploaded: Number(playerStats.totalPhotosUploaded),
          totalRewardsEarned: Number(playerStats.totalRewardsEarned),
          bestScore: Number(playerStats.bestScore),
          averageScore: Number(playerStats.averageScore),
          averageScore30Days: Array.isArray(playerStats.averageScore30Days) && playerStats.averageScore30Days[0] 
            ? Number(playerStats.averageScore30Days[0]) 
            : playerStats.averageScore30Days 
            ? Number(playerStats.averageScore30Days) 
            : undefined,
          rank: playerStats.rank !== null && playerStats.rank !== undefined ? Number(playerStats.rank) : undefined,
          winRate: playerStats.winRate,
          currentStreak: Number(playerStats.currentStreak),
          longestStreak: Number(playerStats.longestStreak),
        });
      } else {
        // If stats are null, reset to default values
        console.log('No player stats returned, using default values');
        setStats({
          totalGamesPlayed: 0,
          totalPhotosUploaded: 0,
          totalRewardsEarned: 0,
          bestScore: 0,
          averageScore: 0,
          averageScore30Days: 0,
          rank: undefined,
          winRate: 0,
          currentStreak: 0,
          longestStreak: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load player stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [principal, isServiceInitialized]);

  // Withdraw tokens function
  const handleWithdraw = async () => {
    if (!identity || !principal) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    if (!withdrawTo.trim()) {
      Alert.alert('Error', 'Please enter a destination principal');
      return;
    }

    if (!withdrawAmount.trim() || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const amountUnits = BigInt(Math.floor(Number(withdrawAmount) * 100)); // Convert to units
    const transferFee = BigInt(1); // 1 unit transfer fee

    if (amountUnits + transferFee > tokenBalance) {
      Alert.alert('Error', 'Insufficient balance (including transfer fee)');
      return;
    }

    setIsWithdrawing(true);

    try {
      const result = await gameService.transferTokens(withdrawTo.trim(), amountUnits);

      if (result.err) {
        throw new Error(result.err);
      }

      Alert.alert('Success', `Transferred ${withdrawAmount} SPOT`);
      setShowWithdrawModal(false);
      setWithdrawTo('');
      setWithdrawAmount('');

      // Reload balance
      loadTokenBalance();

    } catch (error) {
      console.error('Withdraw error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Transfer failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle max button for withdraw
  const handleMaxWithdraw = () => {
    const transferFee = BigInt(1);
    const maxAmount = tokenBalance > transferFee ? tokenBalance - transferFee : BigInt(0);
    const maxAmountSpot = Number(maxAmount) / 100; // Convert to SPOT
    setWithdrawAmount(maxAmountSpot.toFixed(2));
  };

  // Check Pro membership status
  const checkProMembership = useCallback(async () => {
    if (!isServiceInitialized) return;
    
    try {
      const expiryDate = await gameService.getProMembershipExpiry();
      if (expiryDate && expiryDate > new Date()) {
        setIsProMember(true);
        setProExpiryDate(expiryDate);
      } else {
        setIsProMember(false);
        setProExpiryDate(null);
      }
    } catch (error) {
      console.error('Failed to check Pro membership:', error);
    }
  }, [isServiceInitialized]);

  // Load stats when service is ready
  React.useEffect(() => {
    if (isServiceInitialized && currentTab === 'stats') {
      loadPlayerStats();
      checkProMembership();
    }
  }, [isServiceInitialized, currentTab, loadPlayerStats, checkProMembership]);

  // Load user photos
  const loadUserPhotos = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoadingPhotos(true);
    }

    try {
      // Use V2 API to get user photos
      console.log('📸 Loading user photos with principal:', principal?.toString());
      console.log('📸 Identity:', identity);
      console.log('📸 Identity principal:', identity?.getPrincipal()?.toString());
      console.log('📸 Identity type:', identity?.constructor?.name);
      
      const result = await photoServiceV2.getUserPhotos(undefined, 100, identity);
      
      console.log('📸 getUserPhotos result:', {
        photoCount: result.photos.length,
        totalCount: result.totalCount.toString(),
        hasMore: result.hasMore,
        photos: result.photos.map(p => ({
          id: p.id.toString(),
          owner: p.owner.toString(),
          uploadTime: new Date(Number(p.uploadTime) / 1000000).toISOString()
        }))
      });
      
      // デバッグ: 写真ID 2を直接取得してみる
      try {
        const photo2 = await photoServiceV2.getPhotoMetadata(BigInt(2), identity);
        console.log('📸 Direct fetch photo ID 2:', photo2 ? {
          id: photo2.id.toString(),
          owner: photo2.owner.toString(),
          status: photo2.status,
          uploadState: photo2.uploadState
        } : 'Not found');
      } catch (e) {
        console.error('📸 Failed to fetch photo 2:', e);
      }
      
      // 新しい写真が上に来るように降順ソート
      const sortedPhotos = result.photos.sort((a, b) => {
        return Number(b.uploadTime) - Number(a.uploadTime);
      });
      setUserPhotos(sortedPhotos);
    } catch (error) {
      console.error('Failed to load user photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setIsLoadingPhotos(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'photos' && identity) {
      loadUserPhotos();
    }
  }, [currentTab, identity]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const achievements = [
    {
      icon: 'target',
      name: 'Sharpshooter',
      description: 'Guess within 100m',
      unlocked: true,
      progress: 100,
      color: '#3b82f6',
    },
    {
      icon: 'camera',
      name: 'Photographer',
      description: 'Upload 10 photos',
      unlocked: true,
      progress: 100,
      color: '#8b5cf6',
    },
    {
      icon: 'fire',
      name: 'On Fire',
      description: '5 game win streak',
      unlocked: false,
      progress: 60,
      color: '#f59e0b',
    },
    {
      icon: 'star',
      name: 'Rising Star',
      description: 'Reach top 100',
      unlocked: false,
      progress: 30,
      color: '#fbbf24',
    },
  ];

  const statItems = [
    {
      icon: 'game-controller',
      value: stats.totalGamesPlayed || 0,
      label: 'Games',
      color: '#3b82f6'
    },
    {
      icon: 'camera',
      value: stats.totalPhotosUploaded || 0,
      label: 'Photos',
      color: '#8b5cf6'
    },
    {
      icon: 'trophy',
      value: stats.bestScore || 0,
      label: 'Best Score',
      color: '#f59e0b'
    },
    {
      icon: 'analytics',
      value: stats.averageScore30Days || stats.averageScore || 0,
      label: 'Avg Score (30d)',
      color: '#10b981'
    },
    {
      icon: 'medal',
      value: stats.rank ? `#${stats.rank}` : 'Unranked',
      label: 'Rank',
      color: '#ef4444'
    },
    {
      icon: 'flame',
      value: stats.totalRewardsEarned ? Math.floor(stats.totalRewardsEarned / 100) : 0,
      label: 'Rewards',
      color: '#f97316'
    },
  ];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#ffffff" />
          <Text style={styles.backButtonText}>Home</Text>
        </TouchableOpacity>

        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            {/* Profile Row - Horizontal Layout */}
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={48} color="#ffffff" />
              </View>
              <View style={styles.userInfo}>
                <TouchableOpacity onPress={() => {
                  setTempUsername(username);
                  setShowUsernameModal(true);
                }}>
                  <Text style={styles.username}>{username}</Text>
                  <Text style={styles.editUsernameHint}>Tap to edit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={async () => {
                    if (principal) {
                      await Clipboard.setStringAsync(principal.toString());
                      Alert.alert('Copied!', 'Principal ID copied to clipboard');
                    }
                  }}
                >
                  <Text style={styles.principal}>
                    PID: {principal ? principal.toString() : 'Not connected'}
                  </Text>
                  <Text style={styles.copyHint}>Tap to copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceContent}>
                <View>
                  <Text style={styles.balanceLabel}>SPOT Balance</Text>
                  <Text style={styles.balanceValue}>
                    {isLoadingBalance ? '...' : (Number(tokenBalance) / 100).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={() => setShowWithdrawModal(true)}
                >
                  <Text style={styles.withdrawButtonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
              {!isProMember && (
                <TouchableOpacity
                  style={styles.proButton}
                  onPress={() => navigation.navigate('ProMembership')}
                >
                  <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    style={styles.proButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="star" size={16} color="#ffffff" />
                    <Text style={styles.proButtonText}>Go Pro</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <View style={styles.tabs}>
            {[
              { id: 'stats' as const, label: 'Stats', icon: 'bar-chart' },
              { id: 'photos' as const, label: 'Photos', icon: 'image' },
              { id: 'achievements' as const, label: 'Achievements', icon: 'trophy' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, currentTab === tab.id && styles.tabActive]}
                onPress={() => setCurrentTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={currentTab === tab.id ? '#ffffff' : '#94a3b8'}
                />
                <Text style={[
                  styles.tabText,
                  currentTab === tab.id && styles.tabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Content */}
        {currentTab === 'stats' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Stats</Text>
              <View style={styles.statsGrid}>
                {statItems.map((stat, index) => (
                  <View key={index} style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                      {stat.icon === 'trophy' || stat.icon === 'medal' ? (
                        <FontAwesome5 name={stat.icon} size={24} color={stat.color} />
                      ) : (
                        <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                      )}
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {isProMember && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.proActionButton]}
                    onPress={() => navigation.navigate('DetailedStats')}
                  >
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      style={styles.proGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="stats-chart" size={24} color="#fff" />
                      <Text style={styles.proActionButtonText}>Detailed Stats</Text>
                      <Ionicons name="chevron-forward" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="settings" size={24} color="#94a3b8" />
                  <Text style={styles.actionButtonText}>Settings</Text>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                >
                  <Ionicons name="log-out" size={24} color="#ef4444" />
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {currentTab === 'photos' && (
          <View style={styles.tabContent}>
            {isLoadingPhotos ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading photos...</Text>
              </View>
            ) : userPhotos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="camera-outline" size={60} color="#475569" />
                </View>
                <Text style={styles.emptyTitle}>No Photos Yet</Text>
                <Text style={styles.emptyText}>
                  Start uploading photos to contribute to the game
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => navigation.navigate('Camera')}
                >
                  <Text style={styles.primaryButtonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.photosContent}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={() => loadUserPhotos(true)}
                    tintColor="#3b82f6"
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                {userPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id.toString()}
                    photo={photo}
                    onEdit={() => {
                      setEditForm({
                        title: photo.title || '',
                        description: photo.description || '',
                        difficulty: getDifficulty(photo.difficulty),
                        hint: photo.hint || '',
                        tags: photo.tags || [],
                      });
                      setShowEditModal(true);
                    }}
                    onDelete={() => {
                      Alert.alert(
                        'Delete Photo',
                        `Delete "${photo.title || 'Untitled Photo'}"? This cannot be undone.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const result = await photoServiceV2.deletePhoto(photo.id, identity);
                                if (result.err) throw new Error(result.err);
                                Alert.alert('Success', 'Photo deleted');
                                loadUserPhotos();
                              } catch (error) {
                                Alert.alert('Error', 'Failed to delete photo');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {currentTab === 'achievements' && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Your Achievements</Text>
            {achievements.map((achievement, index) => (
              <View
                key={index}
                style={[styles.achievementCard, !achievement.unlocked && styles.achievementCardLocked]}
              >
                <View style={[styles.achievementIcon, { backgroundColor: `${achievement.color}20` }]}>
                  {achievement.icon === 'target' ? (
                    <MaterialCommunityIcons name={achievement.icon} size={28} color={achievement.color} />
                  ) : achievement.icon === 'fire' ? (
                    <FontAwesome5 name={achievement.icon} size={26} color={achievement.color} />
                  ) : (
                    <Ionicons name={achievement.icon as any} size={28} color={achievement.color} />
                  )}
                </View>
                <View style={styles.achievementContent}>
                  <View style={styles.achievementHeader}>
                    <Text style={styles.achievementName}>{achievement.name}</Text>
                    {achievement.unlocked && (
                      <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    )}
                  </View>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[styles.progressFill, { width: `${achievement.progress}%` }]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Photo Info</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.title}
                  onChangeText={(text) => setEditForm({ ...editForm, title: text })}
                  placeholder="Photo title"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editForm.description}
                  onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                  placeholder="Photo description"
                  placeholderTextColor="#64748b"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Difficulty</Text>
                <View style={styles.difficultyOptions}>
                  {(['EASY', 'NORMAL', 'HARD', 'EXTREME'] as const).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.difficultyOption,
                        editForm.difficulty === level && styles.difficultyOptionActive
                      ]}
                      onPress={() => setEditForm({ ...editForm, difficulty: level })}
                    >
                      <Text style={[
                        styles.difficultyOptionText,
                        editForm.difficulty === level && styles.difficultyOptionTextActive
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hint</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.hint}
                  onChangeText={(text) => setEditForm({ ...editForm, hint: text })}
                  placeholder="Hint for players"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, styles.modalButtonDisabled]}
                  onPress={() => {
                    Alert.alert(
                      'Coming Soon',
                      'Photo editing feature will be available in the next update.',
                      [{ text: 'OK' }]
                    );
                  }}
                  disabled={true}
                >
                  <Text style={[styles.modalButtonTextPrimary, { opacity: 0.5 }]}>Save (Coming Soon)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Username Edit Modal */}
      <Modal
        visible={showUsernameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUsernameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity onPress={() => setShowUsernameModal(false)}>
                <Ionicons name="close" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.textInput}
                  value={tempUsername}
                  onChangeText={setTempUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#64748b"
                  maxLength={50}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={async () => {
                    if (tempUsername.trim()) {
                      await saveUsername(tempUsername);
                      setShowUsernameModal(false);
                    }
                  }}
                >
                  <Text style={styles.modalButtonTextPrimary}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowUsernameModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw SPOT Tokens</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Destination Principal</Text>
                <TextInput
                  style={styles.textInput}
                  value={withdrawTo}
                  onChangeText={setWithdrawTo}
                  placeholder="Enter principal ID"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (SPOT)</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.amountInput]}
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.maxButton}
                    onPress={handleMaxWithdraw}
                  >
                    <Text style={styles.maxButtonText}>MAX</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.balanceHint}>
                  Available: {(Number(tokenBalance) / 100).toFixed(2)} SPOT (Transfer fee: 0.01 SPOT)
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, isWithdrawing && styles.modalButtonDisabled]}
                  onPress={handleWithdraw}
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Withdraw</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowWithdrawModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// PhotoImageLoader Component - 画像を非同期で読み込むコンポーネント
const PhotoImageLoader = React.memo(({ photoId }: { photoId: bigint }) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { identity } = useAuth();

  // prevent multiple simultaneous loads
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  useEffect(() => {
    // Reset state when photoId changes
    setImageUri(null);
    setIsLoading(true);

    const loadImage = async () => {
      if (!identity || isLoadingRef) return;

      try {
        setIsLoadingRef(true);

        // 写真の完全なデータを一度に取得（新しいAPI）
        const completeData = await photoServiceV2.getPhotoCompleteData(photoId, identity);
        
        if (!completeData) {
          console.log('❌ No photo data received for photo:', photoId);
          setIsLoading(false);
          return;
        }

        console.log('📷 Complete image data loaded:', {
          photoId: photoId.toString(),
          totalSize: completeData.length
        });

        try {
          // BufferでUint8ArrayからBase64に簡単に変換
          const base64 = Buffer.from(completeData).toString('base64');

          // ローカルファイルに保存
          const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`;
          await FileSystem.writeAsStringAsync(localUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('📷 Photo saved to local cache:', localUri);

          // file://パスを設定（これでData-URIのサイズ制限を回避）
          setImageUri(localUri);

        } catch (error) {
          console.error('📷 Failed to save photo:', error);
          setImageUri(null);
        }
      } catch (error) {
        console.error('Failed to load photo:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingRef(false);
      }
    };

    if (photoId && identity && !isLoadingRef) {
      loadImage();
    }
  }, [photoId]);

  if (isLoading) {
    return (
      <View style={styles.photoImageContainer}>
        <View style={styles.photoImagePlaceholder}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.photoImageLoadingText}>Loading image...</Text>
        </View>
      </View>
    );
  }

  if (!imageUri) {
    return (
      <View style={styles.photoImageContainer}>
        <View style={styles.photoImagePlaceholder}>
          <Ionicons name="image-outline" size={48} color="#94a3b8" />
          <Text style={styles.photoImageErrorText}>Failed to load image</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.photoImageContainer}>
      <Image
        source={{ uri: imageUri }}
        style={styles.photoImage}
        resizeMode="cover"
      />
    </View>
  );
});

// PhotoCard Component
const PhotoCard = ({ photo, onEdit, onDelete }: any) => {
  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const difficultyColors: any = {
    EASY: '#10b981',
    NORMAL: '#3b82f6',
    HARD: '#f59e0b',
    EXTREME: '#ef4444',
  };

  const getSceneLabel = (sceneKind: any): string => {
    if (!sceneKind) return 'Unknown';
    if (sceneKind.Nature) return '自然';
    if (sceneKind.Building) return '建物';
    if (sceneKind.Store) return '店舗';
    if (sceneKind.Facility) return '施設';
    if (sceneKind.Other) return 'その他';
    return 'Unknown';
  };

  return (
    <View style={styles.photoCard}>
      <View style={styles.photoCardHeader}>
        <View style={styles.photoCardInfo}>
          <Text style={styles.photoCardTitle}>
            {(photo.title || 'Untitled Photo').replace(/^/, '')}
          </Text>
          <Text style={styles.photoCardDescription} numberOfLines={2}>
            {photo.description || 'No description'}
          </Text>
        </View>
        <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyColors[getDifficulty(photo.difficulty)]}20` }]}>
          <Text style={[styles.difficultyBadgeText, { color: difficultyColors[getDifficulty(photo.difficulty)] }]}>
            {getDifficulty(photo.difficulty)}
          </Text>
        </View>
      </View>

      {/* 画像を表示 */}
      <PhotoImageLoader photoId={photo.id} />

      <View style={styles.photoCardMeta}>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="location" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {photo.latitude?.toFixed(4) ?? 'N/A'}, {photo.longitude?.toFixed(4) ?? 'N/A'}
          </Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="compass" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {photo.azimuth && photo.azimuth.length > 0 ? `${photo.azimuth[0].toFixed(0)}°` : 'N/A'}
          </Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="calendar" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>{formatTime(photo.uploadTime)}</Text>
        </View>
      </View>

      <View style={styles.photoCardMeta}>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="globe-outline" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {abbreviateLocationName(photo.region, 25)}
          </Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="image-outline" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {getSceneLabel(photo.sceneKind)}
          </Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="server-outline" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {photo.totalSize ? `${(Number(photo.totalSize) / 1024).toFixed(1)} KB` : 'N/A'}
          </Text>
        </View>
      </View>

      {photo.hint && (
        <View style={styles.photoCardHint}>
          <Text style={styles.photoCardHintLabel}>Hint</Text>
          <Text style={styles.photoCardHintText}>{photo.hint}</Text>
        </View>
      )}

      <View style={styles.photoCardActions}>
        <TouchableOpacity
          style={[styles.photoCardButton, styles.photoCardButtonEdit]}
          onPress={onEdit}
        >
          <Feather name="edit-2" size={16} color="#3b82f6" />
          <Text style={styles.photoCardButtonTextEdit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.photoCardButton, styles.photoCardButtonDelete]}
          onPress={onDelete}
        >
          <Feather name="trash-2" size={16} color="#ef4444" />
          <Text style={styles.photoCardButtonTextDelete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 24,
    zIndex: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  profileInfo: {
    // flex: 1を削除
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  editUsernameHint: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 6,
  },
  principal: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyHint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  balanceCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  withdrawButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  withdrawButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  proButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  proButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  proButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  tabs: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    width: '33.333%',
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  actions: {
    marginTop: 24,
  },
  actionButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    marginLeft: 12,
    fontWeight: '600',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  logoutButtonText: {
    color: '#ef4444',
    marginLeft: 12,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
  },
  photosContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 128,
    height: 128,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  achievementCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  achievementCardLocked: {
    opacity: 0.6,
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  achievementName: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  achievementDescription: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  textArea: {
    height: 96,
  },
  difficultyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  difficultyOption: {
    margin: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  difficultyOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  difficultyOptionText: {
    fontWeight: '600',
    color: '#94a3b8',
  },
  difficultyOptionTextActive: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  modalButtonSecondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextPrimary: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalButtonTextSecondary: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  // PhotoCard styles
  photoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  photoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  photoCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  photoCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  photoCardDescription: {
    color: '#94a3b8',
    fontSize: 14,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  photoCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  photoCardMetaText: {
    color: '#94a3b8',
    fontSize: 14,
    marginLeft: 4,
  },
  photoCardHint: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  photoCardHintLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  photoCardHintText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  photoCardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)',
  },
  photoCardButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCardButtonEdit: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  photoCardButtonDelete: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  photoCardButtonTextEdit: {
    color: '#3b82f6',
    marginLeft: 8,
    fontWeight: '600',
  },
  photoCardButtonTextDelete: {
    color: '#ef4444',
    marginLeft: 8,
    fontWeight: '600',
  },
  // Withdraw modal styles
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountInput: {
    flex: 1,
  },
  maxButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  maxButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  balanceHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  // Photo image styles
  photoImageContainer: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  photoImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoImagePlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  photoImageLoadingText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 14,
  },
  photoImageErrorText: {
    color: '#94a3b8',
    marginTop: 8,
    fontSize: 14,
  },
  proActionButton: {
    overflow: 'hidden',
    marginBottom: 12,
  },
  proGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  proActionButtonText: {
    color: '#ffffff',
    marginLeft: 12,
    fontWeight: 'bold',
    flex: 1,
    fontSize: 16,
  },
});