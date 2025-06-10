import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Ionicons, 
  MaterialCommunityIcons, 
  FontAwesome5,
  Feather,
  Foundation
} from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import photoService, { PhotoMetadata, PhotoUpdateInfo } from '../services/photo';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface UserStats {
  totalGamesPlayed: number;
  totalPhotosUploaded: number;
  totalRewardsEarned: number;
  bestScore: number;
  averageScore: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { principal, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<'stats' | 'photos' | 'achievements'>('stats');
  
  const [stats] = useState<UserStats>({
    totalGamesPlayed: 42,
    totalPhotosUploaded: 15,
    totalRewardsEarned: 156.78,
    bestScore: 98,
    averageScore: 76.5,
    winRate: 0.65,
    currentStreak: 3,
    longestStreak: 7,
  });

  // Photo management state
  const [userPhotos, setUserPhotos] = useState<PhotoMetadata[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoMetadata | null>(null);
  const [editForm, setEditForm] = useState<PhotoUpdateInfo>({
    title: '',
    description: '',
    difficulty: 'NORMAL',
    hint: '',
    tags: [],
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Load user photos
  const loadUserPhotos = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoadingPhotos(true);
    }

    try {
      const photos = await photoService.getUserPhotos();
      setUserPhotos(photos);
    } catch (error) {
      console.error('Failed to load user photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setIsLoadingPhotos(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'photos') {
      loadUserPhotos();
    }
  }, [currentTab]);

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
    { icon: 'game-controller', value: stats.totalGamesPlayed, label: 'Games', color: '#3b82f6' },
    { icon: 'camera', value: stats.totalPhotosUploaded, label: 'Photos', color: '#8b5cf6' },
    { icon: 'trophy', value: stats.bestScore, label: 'Best Score', color: '#f59e0b' },
    { icon: 'analytics', value: stats.averageScore.toFixed(1), label: 'Avg Score', color: '#10b981' },
    { icon: 'trending-up', value: `${(stats.winRate * 100).toFixed(0)}%`, label: 'Win Rate', color: '#ef4444' },
    { icon: 'flame', value: stats.currentStreak, label: 'Streak', color: '#f97316' },
  ];

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={48} color="#ffffff" />
            </View>
            <Text style={styles.username}>Anonymous User</Text>
            <Text style={styles.principal}>
              {principal ? `${principal.toString().slice(0, 8)}...` : 'Not connected'}
            </Text>

            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceContent}>
                <View>
                  <Text style={styles.balanceLabel}>SPOT Balance</Text>
                  <Text style={styles.balanceValue}>
                    {stats.totalRewardsEarned.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.withdrawButton}>
                  <Text style={styles.withdrawButtonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.balanceChange}>
                <Ionicons name="trending-up" size={20} color="#10b981" />
                <Text style={styles.balanceChangeText}>+12.5% this week</Text>
              </View>
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
                      {stat.icon === 'trophy' ? (
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
                      setEditingPhoto(photo);
                      setEditForm({
                        title: photo.title || '',
                        description: photo.description || '',
                        difficulty: photo.difficulty || 'NORMAL',
                        hint: photo.hint || '',
                        tags: photo.tags || [],
                      });
                      setShowEditModal(true);
                    }}
                    onDelete={() => {
                      Alert.alert(
                        'Delete Photo',
                        `Delete "${photo.title || 'Untitled'}"? This cannot be undone.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const result = await photoService.deletePhoto(photo.id);
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
                  onChangeText={(text) => setEditForm({...editForm, title: text})}
                  placeholder="Photo title"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editForm.description}
                  onChangeText={(text) => setEditForm({...editForm, description: text})}
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
                      onPress={() => setEditForm({...editForm, difficulty: level})}
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
                  onChangeText={(text) => setEditForm({...editForm, hint: text})}
                  placeholder="Hint for players"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary, isUpdating && styles.modalButtonDisabled]}
                  onPress={async () => {
                    if (!editingPhoto) return;
                    setIsUpdating(true);
                    try {
                      const result = await photoService.updatePhotoInfo(editingPhoto.id, editForm);
                      if (result.err) throw new Error(result.err);
                      Alert.alert('Success', 'Photo updated');
                      setShowEditModal(false);
                      loadUserPhotos();
                    } catch (error) {
                      Alert.alert('Error', 'Failed to update photo');
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalButtonTextPrimary}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// PhotoCard Component
const PhotoCard = ({ photo, onEdit, onDelete }: any) => {
  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const difficultyColors: any = {
    EASY: '#10b981',
    NORMAL: '#3b82f6',
    HARD: '#f59e0b',
    EXTREME: '#ef4444',
  };

  return (
    <View style={styles.photoCard}>
      <View style={styles.photoCardHeader}>
        <View style={styles.photoCardInfo}>
          <Text style={styles.photoCardTitle}>
            {photo.title || 'Untitled Photo'}
          </Text>
          <Text style={styles.photoCardDescription} numberOfLines={2}>
            {photo.description || 'No description'}
          </Text>
        </View>
        <View style={[styles.difficultyBadge, { backgroundColor: `${difficultyColors[photo.difficulty || 'NORMAL']}20` }]}>
          <Text style={[styles.difficultyBadgeText, { color: difficultyColors[photo.difficulty || 'NORMAL'] }]}>
            {photo.difficulty || 'NORMAL'}
          </Text>
        </View>
      </View>

      <View style={styles.photoCardMeta}>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="location" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>
            {photo.lat.toFixed(4)}, {photo.lon.toFixed(4)}
          </Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="compass" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>{photo.azim.toFixed(0)}°</Text>
        </View>
        <View style={styles.photoCardMetaItem}>
          <Ionicons name="calendar" size={16} color="#94a3b8" />
          <Text style={styles.photoCardMetaText}>{formatTime(photo.timestamp)}</Text>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  username: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  principal: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 24,
  },
  balanceCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  balanceChange: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceChangeText: {
    color: '#10b981',
    marginLeft: 8,
    fontSize: 14,
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
});