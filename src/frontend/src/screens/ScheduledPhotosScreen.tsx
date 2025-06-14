import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { photoServiceV2, ScheduledPhoto } from '../services/photoV2';

type ScheduledPhotosScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScheduledPhotos'>;

export default function ScheduledPhotosScreen() {
  const navigation = useNavigation<ScheduledPhotosScreenNavigationProp>();
  const { principal, identity } = useAuth();
  
  const [scheduledPhotos, setScheduledPhotos] = useState<ScheduledPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<bigint>>(new Set());

  // 予約投稿を読み込む
  const loadScheduledPhotos = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const photos = await photoServiceV2.getUserScheduledPhotos(identity);
      // ステータスが pending のものだけフィルタリング
      const pendingPhotos = photos.filter(photo => 
        photo.status && 'Pending' in photo.status
      );
      // 公開予定時刻でソート（早い順）
      pendingPhotos.sort((a, b) => 
        Number(a.scheduledPublishTime - b.scheduledPublishTime)
      );
      setScheduledPhotos(pendingPhotos);
    } catch (error) {
      console.error('Failed to load scheduled photos:', error);
      Alert.alert('エラー', '予約投稿の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadScheduledPhotos();
    
    // 定期的に更新（1分ごと）
    const interval = setInterval(() => {
      loadScheduledPhotos(false);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // キャンセル処理
  const handleCancel = async (photo: ScheduledPhoto) => {
    // 公開5分前のチェック
    const now = Date.now();
    const publishTime = Number(photo.scheduledPublishTime) / 1000000; // ナノ秒からミリ秒に変換
    const timeTillPublish = publishTime - now;
    
    if (timeTillPublish < 5 * 60 * 1000) { // 5分
      Alert.alert(
        'キャンセル不可',
        '公開5分前以降はキャンセルできません'
      );
      return;
    }

    Alert.alert(
      'キャンセル確認',
      `「${photo.title}」の予約投稿をキャンセルしますか？`,
      [
        {
          text: 'いいえ',
          style: 'cancel',
        },
        {
          text: 'はい',
          style: 'destructive',
          onPress: async () => {
            setCancellingIds(prev => new Set(prev).add(photo.id));
            
            try {
              const result = await photoServiceV2.cancelScheduledPhoto(photo.id, identity);
              
              if (result.err) {
                throw new Error(result.err);
              }
              
              Alert.alert('成功', '予約投稿をキャンセルしました');
              // リストを更新
              loadScheduledPhotos();
            } catch (error) {
              console.error('Cancel error:', error);
              Alert.alert('エラー', 'キャンセルに失敗しました');
            } finally {
              setCancellingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(photo.id);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  // 時間表示のフォーマット
  const formatTimeRemaining = (scheduledTime: bigint) => {
    const now = Date.now();
    const publishTime = Number(scheduledTime) / 1000000; // ナノ秒からミリ秒に変換
    const diff = publishTime - now;
    
    if (diff <= 0) {
      return '公開待機中';
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}日${hours % 24}時間後`;
    } else if (hours > 0) {
      return `${hours}時間${minutes % 60}分後`;
    } else {
      return `${minutes}分後`;
    }
  };

  // 公開予定時刻の表示
  const formatScheduledTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // ナノ秒からミリ秒に変換
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // リストアイテムのレンダリング
  const renderScheduledPhoto = ({ item }: { item: ScheduledPhoto }) => {
    const isCancelling = cancellingIds.has(item.id);
    const canCancel = Number(item.scheduledPublishTime) / 1000000 - Date.now() > 5 * 60 * 1000;

    return (
      <View style={styles.photoCard}>
        <View style={styles.photoHeader}>
          <View style={styles.photoInfo}>
            <Text style={styles.photoTitle}>{item.request.title}</Text>
            <Text style={styles.photoDescription} numberOfLines={2}>
              {item.request.description}
            </Text>
          </View>
          <View style={styles.difficultyBadge}>
            <Text style={styles.difficultyText}>
              {item.request.difficulty.EASY ? 'EASY' : 
               item.request.difficulty.NORMAL ? 'NORMAL' :
               item.request.difficulty.HARD ? 'HARD' : 'EXTREME'}
            </Text>
          </View>
        </View>

        <View style={styles.timeSection}>
          <View style={styles.timeInfo}>
            <Text style={styles.timeLabel}>公開予定</Text>
            <Text style={styles.scheduledTime}>
              {formatScheduledTime(item.scheduledPublishTime)}
            </Text>
            <Text style={[
              styles.timeRemaining,
              !canCancel && styles.timeRemainingWarning
            ]}>
              {formatTimeRemaining(item.scheduledPublishTime)}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.cancelButton,
              (!canCancel || isCancelling) && styles.cancelButtonDisabled
            ]}
            onPress={() => handleCancel(item)}
            disabled={!canCancel || isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.cancelButtonText}>
                {canCancel ? 'キャンセル' : 'キャンセル不可'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.photoMeta}>
          <Text style={styles.metaText}>
            📍 {item.request.latitude.toFixed(4)}, {item.request.longitude.toFixed(4)}
          </Text>
          {(Array.isArray(item.request.azimuth) ? item.request.azimuth.length > 0 : item.request.azimuth !== null && item.request.azimuth !== undefined) && (
            <Text style={styles.metaText}>
              🧭 {Array.isArray(item.request.azimuth) ? item.request.azimuth[0].toFixed(0) : item.request.azimuth.toFixed(0)}°
            </Text>
          )}
          <Text style={styles.metaText}>
            🏷️ {item.request.tags.join(', ')}
          </Text>
        </View>

        {item.request.hint && (
          <View style={styles.hintSection}>
            <Text style={styles.hintLabel}>ヒント</Text>
            <Text style={styles.hintText}>{item.request.hint}</Text>
          </View>
        )}
      </View>
    );
  };

  // 空状態の表示
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyTitle}>予約投稿はありません</Text>
      <Text style={styles.emptyDescription}>
        カメラで写真を撮影して、{'\n'}公開時間を指定して投稿しましょう
      </Text>
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={() => navigation.navigate('Camera')}
      >
        <Text style={styles.cameraButtonText}>カメラを開く</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3282b8" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>予約投稿</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countText}>{scheduledPhotos.length}件</Text>
        </View>
      </View>

      <FlatList
        data={scheduledPhotos}
        renderItem={renderScheduledPhoto}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          scheduledPhotos.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadScheduledPhotos(true)}
            tintColor="#3282b8"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#3282b8',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  countText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 12,
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
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
    marginBottom: 16,
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
  timeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  scheduledTime: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  timeRemaining: {
    color: '#3282b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timeRemainingWarning: {
    color: '#ff6b6b',
  },
  cancelButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
    marginTop: 8,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
});