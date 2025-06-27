import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../hooks/useAuth';
import { gameService } from '../../services/game';
import { CustomPrincipal } from '../../utils/principal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DetailedStats {
  // Play history
  totalGamesPlayed: number;
  gamesWon: number;
  gamesAbandoned: number;
  winRate: number;
  
  // Score stats
  totalScore: number;
  averageScore: number;
  bestScore: number;
  
  // Time stats
  totalPlayTime: number;
  averageGameDuration: number;
  fastestGame: number;
  
  // Accuracy stats
  averageDistance: number;
  bestAccuracy: number;
  perfectGuesses: number;
  
  // Photo stats
  photosUploaded: number;
  photoPlays: number;
  photoAverageScore: number;
  
  // Streak stats
  currentStreak: number;
  longestStreak: number;
  
  // Regional stats
  regionStats: Array<{
    region: string;
    gamesPlayed: number;
    averageScore: number;
  }>;
  
  // Recent performance (last 30 days)
  recentPerformance: {
    gamesPlayed: number;
    averageScore: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export default function DetailedStatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { identity } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'accuracy' | 'regions'>('overview');

  useEffect(() => {
    const initAndLoad = async () => {
      if (identity) {
        try {
          await gameService.init(identity);
          await loadDetailedStats();
        } catch (error) {
          console.error('Failed to initialize service:', error);
        }
      }
    };
    initAndLoad();
  }, [identity]);

  const loadDetailedStats = async () => {
    if (!identity) return;

    try {
      setLoading(true);
      
      // Get player stats from game service
      const principal = identity.getPrincipal();
      const playerStats = await gameService.getPlayerStats(CustomPrincipal.fromText(principal.toString()));
      
      if (playerStats) {
        // Transform the stats into our detailed format
        const detailedStats: DetailedStats = {
          totalGamesPlayed: Number(playerStats.totalGamesPlayed),
          gamesWon: Math.floor(Number(playerStats.totalGamesPlayed) * playerStats.winRate), // Calculate from win rate
          gamesAbandoned: 0, // Not available in current stats
          winRate: playerStats.winRate * 100,
          
          totalScore: Number(playerStats.totalRewardsEarned), // Using rewards as proxy for score
          averageScore: Number(playerStats.averageScore),
          bestScore: Number(playerStats.bestScore),
          
          totalPlayTime: 0, // Not available in current stats
          averageGameDuration: 0, // Not available in current stats
          fastestGame: 0, // Not available in current stats
          
          averageDistance: 0, // Not available in current stats
          bestAccuracy: 0, // Not available in current stats
          perfectGuesses: 0, // Not available in current stats
          
          photosUploaded: Number(playerStats.totalPhotosUploaded),
          photoPlays: 0, // Not available in current stats
          photoAverageScore: 0, // Not available in current stats
          
          currentStreak: Number(playerStats.currentStreak),
          longestStreak: Number(playerStats.longestStreak),
          
          regionStats: [], // Would need additional API call
          
          recentPerformance: {
            gamesPlayed: 0, // Not available in current format
            averageScore: playerStats.averageScore30Days && Array.isArray(playerStats.averageScore30Days) && playerStats.averageScore30Days.length > 0 
              ? Number(playerStats.averageScore30Days[0]) 
              : 0,
            trend: 'stable', // Default to stable since we don't have trend data
          },
        };
        
        setStats(detailedStats);
      }
    } catch (error) {
      console.error('Failed to load detailed stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (nanoseconds: number): string => {
    const seconds = Math.floor(nanoseconds / 1_000_000_000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={24} color="#FFD700" />
          <Text style={styles.statValue}>{stats?.gamesWon || 0}</Text>
          <Text style={styles.statLabel}>Games Won</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="analytics" size={24} color="#4ECDC4" />
          <Text style={styles.statValue}>{stats?.winRate.toFixed(1) || 0}%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="star" size={24} color="#FF6B6B" />
          <Text style={styles.statValue}>{stats?.bestScore.toLocaleString() || 0}</Text>
          <Text style={styles.statLabel}>Best Score</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="flame" size={24} color="#FF8E53" />
          <Text style={styles.statValue}>{stats?.currentStreak || 0}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Performance (30 days)</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Games Played</Text>
            <Text style={styles.performanceValue}>{stats?.recentPerformance.gamesPlayed || 0}</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Average Score</Text>
            <Text style={styles.performanceValue}>{stats?.recentPerformance.averageScore.toFixed(0) || 0}</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Trend</Text>
            <View style={styles.trendContainer}>
              <Ionicons 
                name={stats?.recentPerformance.trend === 'up' ? 'trending-up' : 
                      stats?.recentPerformance.trend === 'down' ? 'trending-down' : 'remove'}
                size={20} 
                color={stats?.recentPerformance.trend === 'up' ? '#4ECDC4' : 
                       stats?.recentPerformance.trend === 'down' ? '#FF6B6B' : '#666'}
              />
              <Text style={[
                styles.trendText,
                { color: stats?.recentPerformance.trend === 'up' ? '#4ECDC4' : 
                         stats?.recentPerformance.trend === 'down' ? '#FF6B6B' : '#666' }
              ]}>
                {stats?.recentPerformance.trend === 'up' ? 'Improving' : 
                 stats?.recentPerformance.trend === 'down' ? 'Declining' : 'Stable'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAccuracyTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Ionicons name="location" size={24} color="#4ECDC4" />
          <Text style={styles.statValue}>{stats?.averageDistance.toFixed(0) || 0} km</Text>
          <Text style={styles.statLabel}>Avg Distance</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
          <Text style={styles.statValue}>{stats?.bestAccuracy.toFixed(0) || 0} km</Text>
          <Text style={styles.statLabel}>Best Accuracy</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="pin" size={24} color="#FFD700" />
          <Text style={styles.statValue}>{stats?.perfectGuesses || 0}</Text>
          <Text style={styles.statLabel}>Perfect Guesses</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time Statistics</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Total Play Time</Text>
            <Text style={styles.performanceValue}>{formatTime(stats?.totalPlayTime || 0)}</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Average Game Duration</Text>
            <Text style={styles.performanceValue}>{formatTime(stats?.averageGameDuration || 0)}</Text>
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Fastest Game</Text>
            <Text style={styles.performanceValue}>{formatTime(stats?.fastestGame || 0)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#1a1a2e', '#0f1117']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading detailed statistics...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#0f1117']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Detailed Statistics</Text>
          <View style={styles.backButton} />
        </View>

        {/* Pro Badge */}
        <View style={styles.proBadgeContainer}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.proBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={styles.proBadgeText}>PRO EXCLUSIVE</Text>
          </LinearGradient>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
            onPress={() => setSelectedTab('overview')}
          >
            <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'accuracy' && styles.activeTab]}
            onPress={() => setSelectedTab('accuracy')}
          >
            <Text style={[styles.tabText, selectedTab === 'accuracy' && styles.activeTabText]}>
              Accuracy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'accuracy' && renderAccuracyTab()}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  proBadgeContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4ECDC4',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    paddingBottom: 40,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  performanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  performanceLabel: {
    fontSize: 14,
    color: '#999',
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
});