import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
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
  const { principal, logout } = useAuthStore();
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

  // 写真管理用の状態
  const [userPhotos, setUserPhotos] = useState<PhotoMetadata[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoMetadata | null>(null);
  const [currentTab, setCurrentTab] = useState<'stats' | 'photos'>('stats');

  // 編集フォームの状態
  const [editForm, setEditForm] = useState<PhotoUpdateInfo>({
    title: '',
    description: '',
    difficulty: 'NORMAL',
    hint: '',
    tags: [],
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // 写真一覧を読み込む
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
      Alert.alert('エラー', '写真の読み込みに失敗しました');
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

  // 編集モーダルを開く
  const openEditModal = (photo: PhotoMetadata) => {
    setEditingPhoto(photo);
    setEditForm({
      title: photo.title || '',
      description: photo.description || '',
      difficulty: photo.difficulty || 'NORMAL',
      hint: photo.hint || '',
      tags: photo.tags || [],
    });
    setShowEditModal(true);
  };

  // 編集を保存
  const handleSaveEdit = async () => {
    if (!editingPhoto) return;

    setIsUpdating(true);
    try {
      const result = await photoService.updatePhotoInfo(editingPhoto.id, editForm);
      
      if (result.err) {
        throw new Error(result.err);
      }

      Alert.alert('成功', '写真情報を更新しました');
      setShowEditModal(false);
      loadUserPhotos(); // リストを再読み込み
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('エラー', '更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  // 写真を削除
  const handleDeletePhoto = (photo: PhotoMetadata) => {
    Alert.alert(
      '削除確認',
      `「${photo.title || 'Untitled'}」を削除しますか？\nこの操作は取り消せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await photoService.deletePhoto(photo.id);
              
              if (result.err) {
                throw new Error(result.err);
              }

              Alert.alert('成功', '写真を削除しました');
              loadUserPhotos(); // リストを再読み込み
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('エラー', '削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  // 時間のフォーマット
  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // ナノ秒からミリ秒に変換
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      '本当にログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const StatCard = ({ title, value, unit = '' }: { title: string; value: string | number; unit?: string }) => (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>
        {value}{unit}
      </Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  // 写真リストのレンダリング
  const renderPhotoList = () => {
    if (isLoadingPhotos) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3282b8" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      );
    }

    if (userPhotos.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>投稿した写真がありません</Text>
          <Text style={styles.emptyDescription}>
            カメラで写真を撮影して投稿しましょう
          </Text>
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => navigation.navigate('Camera')}
          >
            <Text style={styles.cameraButtonText}>カメラを開く</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.photosContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadUserPhotos(true)}
            tintColor="#3282b8"
          />
        }
      >
        {userPhotos.map((photo) => (
          <View key={photo.id.toString()} style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <View style={styles.photoInfo}>
                <Text style={styles.photoTitle}>
                  {photo.title || 'Untitled'}
                </Text>
                <Text style={styles.photoDescription} numberOfLines={2}>
                  {photo.description || 'No description'}
                </Text>
              </View>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>
                  {photo.difficulty || 'NORMAL'}
                </Text>
              </View>
            </View>

            <View style={styles.photoMeta}>
              <Text style={styles.metaText}>
                📍 {photo.lat.toFixed(4)}, {photo.lon.toFixed(4)}
              </Text>
              <Text style={styles.metaText}>
                🧭 {photo.azim.toFixed(0)}°
              </Text>
              <Text style={styles.metaText}>
                📅 {formatTime(photo.timestamp)}
              </Text>
            </View>

            {photo.hint && (
              <View style={styles.hintSection}>
                <Text style={styles.hintLabel}>ヒント</Text>
                <Text style={styles.hintText}>{photo.hint}</Text>
              </View>
            )}

            {photo.tags && photo.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsLabel}>タグ</Text>
                <Text style={styles.tagsText}>{photo.tags.join(', ')}</Text>
              </View>
            )}

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(photo)}
              >
                <Text style={styles.editButtonText}>編集</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePhoto(photo)}
              >
                <Text style={styles.deleteButtonText}>削除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.username}>Anonymous User</Text>
        <Text style={styles.principal}>
          {principal ? principal.toString() : 'Not connected'}
        </Text>
      </View>

      {/* Token Balance */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>SPOT Balance</Text>
        <Text style={styles.balanceValue}>{stats.totalRewardsEarned.toFixed(2)}</Text>
        <TouchableOpacity style={styles.withdrawButton}>
          <Text style={styles.withdrawButtonText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'stats' && styles.activeTab]}
          onPress={() => setCurrentTab('stats')}
        >
          <Text style={[styles.tabText, currentTab === 'stats' && styles.activeTabText]}>
            統計
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentTab === 'photos' && styles.activeTab]}
          onPress={() => setCurrentTab('photos')}
        >
          <Text style={[styles.tabText, currentTab === 'photos' && styles.activeTabText]}>
            投稿写真 ({userPhotos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {currentTab === 'stats' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Stats Grid */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Game Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard title="Games Played" value={stats.totalGamesPlayed} />
              <StatCard title="Photos Uploaded" value={stats.totalPhotosUploaded} />
              <StatCard title="Best Score" value={stats.bestScore} />
              <StatCard title="Average Score" value={stats.averageScore.toFixed(1)} />
              <StatCard title="Win Rate" value={(stats.winRate * 100).toFixed(0)} unit="%" />
              <StatCard title="Current Streak" value={stats.currentStreak} />
            </View>
          </View>

          {/* Achievements */}
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsList}>
              {[
                { icon: '🎯', name: 'Sharpshooter', description: 'Guess within 100m' },
                { icon: '📷', name: 'Photographer', description: 'Upload 10 photos' },
                { icon: '🔥', name: 'On Fire', description: '5 game win streak' },
                { icon: '🌟', name: 'Rising Star', description: 'Reach top 100' },
              ].map((achievement, index) => (
                <View key={index} style={styles.achievementItem}>
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  <View style={styles.achievementInfo}>
                    <Text style={styles.achievementName}>{achievement.name}</Text>
                    <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
                Logout
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        renderPhotoList()
      )}

      {/* 編集モーダル */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.editModalContainer} edges={['top', 'left', 'right']}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>写真情報を編集</Text>
            <TouchableOpacity
              style={styles.editModalClose}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.editModalCloseText}>閉じる</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editModalContent}>
            <View style={styles.editFormGroup}>
              <Text style={styles.editLabel}>タイトル</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.title}
                onChangeText={(text) => setEditForm({...editForm, title: text})}
                placeholder="写真のタイトル"
                placeholderTextColor="#64748b"
                maxLength={100}
              />
            </View>

            <View style={styles.editFormGroup}>
              <Text style={styles.editLabel}>説明</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editForm.description}
                onChangeText={(text) => setEditForm({...editForm, description: text})}
                placeholder="写真の説明"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.editFormGroup}>
              <Text style={styles.editLabel}>難易度</Text>
              <View style={styles.difficultyButtons}>
                {(['EASY', 'NORMAL', 'HARD', 'EXTREME'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.difficultyButton,
                      editForm.difficulty === level && styles.difficultyButtonActive
                    ]}
                    onPress={() => setEditForm({...editForm, difficulty: level})}
                  >
                    <Text style={[
                      styles.difficultyButtonText,
                      editForm.difficulty === level && styles.difficultyButtonTextActive
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.editFormGroup}>
              <Text style={styles.editLabel}>ヒント</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.hint}
                onChangeText={(text) => setEditForm({...editForm, hint: text})}
                placeholder="プレイヤーへのヒント"
                placeholderTextColor="#64748b"
                maxLength={100}
              />
            </View>

            <View style={styles.editFormGroup}>
              <Text style={styles.editLabel}>タグ（カンマ区切り）</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.tags.join(', ')}
                onChangeText={(text) => setEditForm({
                  ...editForm, 
                  tags: text.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                })}
                placeholder="例: 東京,観光地,桜"
                placeholderTextColor="#64748b"
              />
            </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editSaveButton, isUpdating && styles.editSaveButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.editSaveButtonText}>保存</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => setShowEditModal(false)}
                disabled={isUpdating}
              >
                <Text style={styles.editCancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 40,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  principal: {
    fontSize: 12,
    color: '#94a3b8',
  },
  balanceContainer: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 5,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 15,
  },
  withdrawButton: {
    backgroundColor: '#3282b8',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  withdrawButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  statCard: {
    width: '31%',
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 8,
    margin: 5,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3282b8',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  achievementsSection: {
    marginBottom: 30,
  },
  achievementsList: {
    gap: 10,
  },
  achievementItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  achievementIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 12,
    color: '#94a3b8',
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 0,
  },
  actionButtonText: {
    color: '#3282b8',
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#ff6b6b',
  },
  logoutButtonText: {
    color: '#ffffff',
  },
  // タブ関連のスタイル
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#3282b8',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  // 写真リスト関連のスタイル
  photosContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  cameraButton: {
    backgroundColor: '#3282b8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cameraButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  photoInfo: {
    flex: 1,
    marginRight: 12,
  },
  photoTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  photoDescription: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  difficultyBadge: {
    backgroundColor: '#3282b8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  difficultyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  hintSection: {
    backgroundColor: '#0f1117',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  hintLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  tagsSection: {
    backgroundColor: '#0f1117',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  tagsLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  tagsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3282b8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ff6b6b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // 編集モーダル関連のスタイル
  editModalContainer: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  editModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editModalClose: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editModalCloseText: {
    color: '#3282b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editModalContent: {
    flex: 1,
    padding: 20,
  },
  editFormGroup: {
    marginBottom: 20,
  },
  editLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 16,
    padding: 12,
  },
  editTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  difficultyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  difficultyButton: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#3282b8',
    borderColor: '#3282b8',
  },
  difficultyButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  difficultyButtonTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: '#3282b8',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editSaveButtonDisabled: {
    opacity: 0.6,
  },
  editSaveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editCancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
});