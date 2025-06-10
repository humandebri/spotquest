import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MaterialIcons,
  Ionicons,
  FontAwesome5,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import { adminService } from '../services/admin';

// タブの定義
const TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
  { id: 'games', name: 'Games', icon: 'games' },
  { id: 'photos', name: 'Photos', icon: 'photo-library' },
  { id: 'users', name: 'Users', icon: 'people' },
  { id: 'settings', name: 'Settings', icon: 'settings' },
];

export default function AdminScreen({ navigation }: any) {
  const { principal, isAdmin, identity } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeGames: 0,
    totalPhotos: 0,
    totalRewards: 0,
  });

  useEffect(() => {
    // モバイルからのアクセスを防ぐ
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Access Denied',
        'Admin dashboard is only available on web',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
      return;
    }
    
    if (!isAdmin) {
      navigation.navigate('Home');
      return;
    }
    loadDashboardData();
  }, [isAdmin]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const data = await adminService.getDashboardStats(identity);
      setStats({
        totalUsers: data.totalUsers,
        activeGames: data.activeGames,
        totalPhotos: data.totalPhotos,
        totalRewards: data.totalRewards,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab stats={stats} />;
      case 'games':
        return <GamesTab identity={identity} />;
      case 'photos':
        return <PhotosTab identity={identity} />;
      case 'users':
        return <UsersTab identity={identity} />;
      case 'settings':
        return <SettingsTab identity={identity} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? '#3b82f6' : '#64748b'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText,
                ]}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          renderTabContent()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ダッシュボードタブ
const DashboardTab = ({ stats }: any) => (
  <View style={styles.dashboardContainer}>
    <Text style={styles.sectionTitle}>Overview</Text>
    <View style={styles.statsGrid}>
      <StatCard
        title="Total Users"
        value={stats.totalUsers}
        icon="people"
        color="#3b82f6"
      />
      <StatCard
        title="Active Games"
        value={stats.activeGames}
        icon="games"
        color="#22c55e"
      />
      <StatCard
        title="Total Photos"
        value={stats.totalPhotos}
        icon="photo-library"
        color="#f59e0b"
      />
      <StatCard
        title="Total Rewards"
        value={`${stats.totalRewards} SPOT`}
        icon="monetization-on"
        color="#ef4444"
      />
    </View>

    <Text style={styles.sectionTitle}>Recent Activity</Text>
    <ActivityItem
      icon="photo-camera"
      title="New photo uploaded"
      description="User xyz uploaded a new photo"
      time="5 minutes ago"
    />
    <ActivityItem
      icon="games"
      title="Game completed"
      description="Round #123 completed with 45 players"
      time="1 hour ago"
    />
    <ActivityItem
      icon="person-add"
      title="New user registered"
      description="Welcome user abc to the platform"
      time="2 hours ago"
    />
  </View>
);

// ゲーム管理タブ
const GamesTab = () => {
  const [games, setGames] = useState<any[]>([]);

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Active Games</Text>
      <GameItem
        id="1"
        photoId="123"
        players={23}
        timeLeft="12:34"
        status="active"
      />
      <GameItem
        id="2"
        photoId="124"
        players={45}
        timeLeft="08:15"
        status="active"
      />

      <Text style={styles.sectionTitle}>Recent Games</Text>
      <GameItem
        id="3"
        photoId="122"
        players={67}
        rewards={1234}
        status="completed"
      />
    </View>
  );
};

// 写真管理タブ
const PhotosTab = () => {
  return (
    <View style={styles.tabContent}>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="filter-list" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="sort" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Sort</Text>
        </TouchableOpacity>
      </View>

      <PhotoItem
        id="123"
        owner="abc...xyz"
        uploadDate="2024-01-15"
        quality={0.85}
        reports={0}
      />
      <PhotoItem
        id="124"
        owner="def...uvw"
        uploadDate="2024-01-14"
        quality={0.92}
        reports={1}
      />
    </View>
  );
};

// ユーザー管理タブ
const UsersTab = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.tabContent}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        placeholderTextColor="#64748b"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <UserItem
        principal="abc...xyz"
        username="player123"
        reputation={0.95}
        totalGames={234}
        isBanned={false}
      />
      <UserItem
        principal="def...uvw"
        username="photographer99"
        reputation={0.88}
        totalGames={156}
        isBanned={false}
      />
    </View>
  );
};

// 設定タブ
const SettingsTab = ({ identity }: { identity?: any }) => {
  const [playFee, setPlayFee] = useState('10');
  const [baseReward, setBaseReward] = useState('100');
  const [uploaderRatio, setUploaderRatio] = useState('30');

  const handleSaveSettings = () => {
    Alert.alert(
      'Save Settings',
      'Are you sure you want to save these settings?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            try {
              await adminService.updateSystemSettings({
                playFee: parseInt(playFee),
                baseReward: parseInt(baseReward),
                uploaderRewardRatio: parseFloat(uploaderRatio),
              }, identity);
              Alert.alert('Success', 'Settings saved successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to save settings');
              console.error('Failed to save settings:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Game Settings</Text>
      
      <SettingItem
        label="Play Fee (SPOT)"
        value={playFee}
        onChangeText={setPlayFee}
        keyboardType="numeric"
      />
      <SettingItem
        label="Base Reward (SPOT)"
        value={baseReward}
        onChangeText={setBaseReward}
        keyboardType="numeric"
      />
      <SettingItem
        label="Uploader Reward Ratio (%)"
        value={uploaderRatio}
        onChangeText={setUploaderRatio}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveSettings}
      >
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
};

// コンポーネント部品
const StatCard = ({ title, value, icon, color }: any) => (
  <View style={[styles.statCard, { borderColor: color }]}>
    <MaterialIcons name={icon} size={32} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const ActivityItem = ({ icon, title, description, time }: any) => (
  <View style={styles.activityItem}>
    <MaterialIcons name={icon} size={24} color="#3b82f6" />
    <View style={styles.activityContent}>
      <Text style={styles.activityTitle}>{title}</Text>
      <Text style={styles.activityDescription}>{description}</Text>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  </View>
);

const GameItem = ({ id, photoId, players, timeLeft, rewards, status }: any) => (
  <View style={styles.listItem}>
    <View style={styles.listItemContent}>
      <Text style={styles.listItemTitle}>Game #{id}</Text>
      <Text style={styles.listItemSubtitle}>Photo ID: {photoId}</Text>
      <Text style={styles.listItemInfo}>
        {players} players
        {status === 'active' ? ` • ${timeLeft} left` : ` • ${rewards} SPOT distributed`}
      </Text>
    </View>
    <View style={[styles.statusBadge, status === 'active' ? styles.activeBadge : styles.completedBadge]}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  </View>
);

const PhotoItem = ({ id, owner, uploadDate, quality, reports }: any) => (
  <View style={styles.listItem}>
    <View style={styles.listItemContent}>
      <Text style={styles.listItemTitle}>Photo #{id}</Text>
      <Text style={styles.listItemSubtitle}>Owner: {owner}</Text>
      <Text style={styles.listItemInfo}>
        Uploaded: {uploadDate} • Quality: {(quality * 100).toFixed(0)}%
      </Text>
    </View>
    {reports > 0 && (
      <View style={styles.warningBadge}>
        <Text style={styles.warningText}>{reports} reports</Text>
      </View>
    )}
  </View>
);

const UserItem = ({ principal, username, reputation, totalGames, isBanned }: any) => (
  <View style={styles.listItem}>
    <View style={styles.listItemContent}>
      <Text style={styles.listItemTitle}>{username || 'Anonymous'}</Text>
      <Text style={styles.listItemSubtitle}>{principal}</Text>
      <Text style={styles.listItemInfo}>
        Rep: {(reputation * 100).toFixed(0)}% • Games: {totalGames}
      </Text>
    </View>
    {isBanned && (
      <View style={styles.bannedBadge}>
        <Text style={styles.bannedText}>BANNED</Text>
      </View>
    )}
  </View>
);

const SettingItem = ({ label, value, onChangeText, keyboardType = 'default' }: any) => (
  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>{label}</Text>
    <TextInput
      style={styles.settingInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  backButton: {
    padding: 8,
  },
  tabContainer: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  dashboardContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  statTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  activityDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  tabContent: {
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  listItemInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  activeBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  completedBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
    textTransform: 'uppercase',
  },
  warningBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fbbf24',
  },
  bannedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  bannedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  settingInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});