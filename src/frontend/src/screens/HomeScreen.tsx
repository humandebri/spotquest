import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { principal, isAdmin } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const menuItems = [
    {
      title: 'Play Game',
      description: 'Guess locations & earn rewards',
      icon: 'game-controller',
      screen: 'Game' as const,
      gradient: ['#3b82f6', '#2563eb'],
    },
    {
      title: 'Take Photo',
      description: 'Upload GPS-tagged photos',
      icon: 'camera',
      screen: 'Camera' as const,
      gradient: ['#8b5cf6', '#7c3aed'],
    },
    {
      title: 'Leaderboard',
      description: 'Top players & rankings',
      icon: 'trophy',
      screen: 'Leaderboard' as const,
      gradient: ['#f59e0b', '#d97706'],
    },
    {
      title: 'My Profile',
      description: 'Stats, NFTs & rewards',
      icon: 'person',
      screen: 'Profile' as const,
      gradient: ['#10b981', '#059669'],
    },
    ...(isAdmin && Platform.OS === 'web' ? [{
      title: 'Admin Dashboard',
      description: 'Manage games & users',
      icon: 'shield-checkmark',
      screen: 'Admin' as const,
      gradient: ['#ef4444', '#dc2626'],
    }] : []),
  ];

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.principalText}>
                {principal ? `${principal.toString().slice(0, 8)}...` : 'Explorer'}
              </Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Stats Card */}
          <View style={styles.statsCard}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.statsGradient}
            >
              <View style={styles.statsHeader}>
                <View>
                  <Text style={styles.statsLabel}>Total Balance</Text>
                  <Text style={styles.statsValue}>0 SPOT</Text>
                </View>
                <View style={styles.statsBadge}>
                  <Text style={styles.statsBadgeText}>+0%</Text>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <StatItem icon="game-controller-outline" value="0" label="Games" />
                <StatItem icon="camera-outline" value="0" label="Photos" />
                <StatItem icon="medal" value="#0" label="Rank" />
                <StatItem icon="trophy-outline" value="0" label="Wins" />
              </View>
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.screen}
                style={styles.menuCard}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={item.gradient}
                  style={styles.menuGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.menuIconContainer}>
                    {item.icon === 'trophy' ? (
                      <FontAwesome5 name={item.icon} size={28} color="#ffffff" />
                    ) : item.icon === 'person' ? (
                      <MaterialCommunityIcons name="account-circle" size={28} color="#ffffff" />
                    ) : (
                      <Ionicons name={item.icon as any} size={28} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuDescription}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>
                Start playing to see your game history
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const StatItem = ({ icon, value, label }: any) => (
  <View style={styles.statItem}>
    <View style={styles.statIconContainer}>
      {icon === 'medal' ? (
        <FontAwesome5 name={icon} size={18} color="#f59e0b" />
      ) : icon === 'trophy-outline' ? (
        <MaterialCommunityIcons name={icon} size={20} color="#10b981" />
      ) : (
        <Ionicons name={icon} size={20} color={icon.includes('game') ? '#3b82f6' : '#8b5cf6'} />
      )}
    </View>
    <Text style={styles.statItemValue}>{value}</Text>
    <Text style={styles.statItemLabel}>{label}</Text>
  </View>
);

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  welcomeText: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  principalText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  notificationButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  statsGradient: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  statsValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statsBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    height: 32,
  },
  statsBadgeText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statItemValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statItemLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  section: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  menuCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  menuGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});