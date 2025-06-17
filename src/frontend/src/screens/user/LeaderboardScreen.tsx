import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Foundation } from '@expo/vector-icons';

interface LeaderboardEntry {
  rank: number;
  principal: string;
  username?: string;
  score: number;
  gamesPlayed: number;
  photosUploaded: number;
  totalRewards: number;
  change?: number;
}

type LeaderboardType = 'global' | 'uploaders' | 'weekly' | 'monthly';

export default function LeaderboardScreen() {
  const [selectedType, setSelectedType] = useState<LeaderboardType>('global');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedType]);

  const loadLeaderboard = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // TODO: Fetch from ICP
      setTimeout(() => {
        const mockData: LeaderboardEntry[] = Array.from({ length: 50 }, (_, i) => ({
          rank: i + 1,
          principal: `2vxsx-${Math.random().toString(36).substr(2, 5)}`,
          username: `Player${i + 1}`,
          score: Math.floor(Math.random() * 1000) + 100,
          gamesPlayed: Math.floor(Math.random() * 100) + 10,
          photosUploaded: Math.floor(Math.random() * 50),
          totalRewards: Math.floor(Math.random() * 500) + 50,
          change: i < 5 ? Math.floor(Math.random() * 5) - 2 : Math.floor(Math.random() * 10) - 5,
        })).sort((a, b) => b.score - a.score);

        setData(mockData);
        setIsLoading(false);
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const tabs = [
    { key: 'global' as LeaderboardType, label: 'Global', icon: 'earth', color: '#3b82f6' },
    { key: 'uploaders' as LeaderboardType, label: 'Uploaders', icon: 'camera', color: '#8b5cf6' },
    { key: 'weekly' as LeaderboardType, label: 'Weekly', icon: 'calendar-week', color: '#f59e0b' },
    { key: 'monthly' as LeaderboardType, label: 'Monthly', icon: 'calendar-month', color: '#10b981' },
  ];

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    if (item.rank <= 3) return null; // Top 3 shown in podium
    
    return (
      <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>#{item.rank}</Text>
          {item.change !== 0 && item.change !== undefined && (
            <View style={styles.changeContainer}>
              <Ionicons 
                name={item.change > 0 ? 'caret-up' : 'caret-down'} 
                size={12} 
                color={item.change > 0 ? '#10b981' : '#ef4444'} 
              />
              <Text style={[styles.changeText, { color: item.change > 0 ? '#10b981' : '#ef4444' }]}>
                {Math.abs(item.change)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.username}>
            {item.username || `${item.principal.slice(0, 8)}...`}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="game-controller-outline" size={14} color="#94a3b8" />
              <Text style={styles.statText}>{item.gamesPlayed}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="camera-outline" size={14} color="#94a3b8" />
              <Text style={styles.statText}>{item.photosUploaded}</Text>
            </View>
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreText}>{item.score}</Text>
          <View style={styles.rewardsContainer}>
            <Foundation name="bitcoin-circle" size={14} color="#f59e0b" />
            <Text style={styles.rewardsText}>{item.totalRewards}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Top players competing for glory</Text>
        </View>

        {/* Your Rank Card */}
        <View style={styles.rankCardContainer}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={styles.rankCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.rankCardContent}>
              <View>
                <Text style={styles.rankCardLabel}>Your Rank</Text>
                <Text style={styles.rankCardValue}>#42</Text>
                <View style={styles.rankCardChange}>
                  <Ionicons name="trending-up" size={16} color="#10b981" />
                  <Text style={styles.rankCardChangeText}>+3 from last week</Text>
                </View>
              </View>
              <View style={styles.rankCardRight}>
                <Text style={styles.rankCardLabel}>Total Score</Text>
                <Text style={styles.rankCardScore}>1,245</Text>
                <Text style={styles.rankCardRewards}>156.78 SPOT</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabContainer}
          contentContainerStyle={styles.tabContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                selectedType === tab.key && styles.tabActive
              ]}
              onPress={() => setSelectedType(tab.key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name={tab.icon as any} 
                size={18} 
                color={selectedType === tab.key ? '#ffffff' : '#94a3b8'} 
              />
              <Text style={[
                styles.tabText,
                selectedType === tab.key && styles.tabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Leaderboard List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading rankings...</Text>
          </View>
        ) : (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item) => item.principal}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadLeaderboard(true)}
                tintColor="#3b82f6"
              />
            }
            ListHeaderComponent={() => (
              <View style={styles.podiumContainer}>
                {data.length >= 3 && (
                  <View style={styles.podium}>
                    {/* 2nd Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBox, { height: 100 }]}>
                        <Text style={styles.medal}>🥈</Text>
                        <Text style={styles.podiumName} numberOfLines={1}>
                          {data[1].username || `${data[1].principal.slice(0, 6)}...`}
                        </Text>
                        <Text style={styles.podiumScore}>{data[1].score}</Text>
                        <Text style={styles.podiumRewards}>{data[1].totalRewards} SPOT</Text>
                      </View>
                    </View>
                    {/* 1st Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBox, { height: 120 }]}>
                        <Text style={styles.medal}>🥇</Text>
                        <Text style={styles.podiumName} numberOfLines={1}>
                          {data[0].username || `${data[0].principal.slice(0, 6)}...`}
                        </Text>
                        <Text style={styles.podiumScore}>{data[0].score}</Text>
                        <Text style={styles.podiumRewards}>{data[0].totalRewards} SPOT</Text>
                      </View>
                    </View>
                    {/* 3rd Place */}
                    <View style={styles.podiumPlace}>
                      <View style={[styles.podiumBox, { height: 80 }]}>
                        <Text style={styles.medal}>🥉</Text>
                        <Text style={styles.podiumName} numberOfLines={1}>
                          {data[2].username || `${data[2].principal.slice(0, 6)}...`}
                        </Text>
                        <Text style={styles.podiumScore}>{data[2].score}</Text>
                        <Text style={styles.podiumRewards}>{data[2].totalRewards} SPOT</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
          />
        )}
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
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
  rankCardContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  rankCard: {
    borderRadius: 16,
    padding: 20,
  },
  rankCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankCardLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  rankCardValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  rankCardChange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  rankCardChangeText: {
    color: '#10b981',
    marginLeft: 4,
    fontSize: 14,
  },
  rankCardRight: {
    alignItems: 'flex-end',
  },
  rankCardScore: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  rankCardRewards: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  tabContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tabContent: {
    paddingRight: 20,
  },
  tab: {
    marginRight: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  tabText: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
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
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  podiumContainer: {
    marginBottom: 24,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  podiumPlace: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  podiumBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    width: 100,
  },
  medal: {
    fontSize: 36,
    marginBottom: 8,
  },
  podiumName: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  podiumScore: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  podiumRewards: {
    color: '#94a3b8',
    fontSize: 12,
  },
  listItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  rankContainer: {
    width: 48,
    alignItems: 'center',
  },
  rankText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  changeText: {
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  username: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 4,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  rewardsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rewardsText: {
    color: '#94a3b8',
    fontSize: 14,
    marginLeft: 4,
  },
});