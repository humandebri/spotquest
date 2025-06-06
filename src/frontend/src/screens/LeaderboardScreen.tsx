import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LeaderboardEntry {
  rank: number;
  principal: string;
  username?: string;
  score: number;
  gamesPlayed: number;
  photosUploaded: number;
  totalRewards: number;
}

type LeaderboardType = 'players' | 'uploaders' | 'weekly' | 'monthly';

export default function LeaderboardScreen() {
  const [selectedType, setSelectedType] = useState<LeaderboardType>('players');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, [selectedType]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      // TODO: ICPからリーダーボードデータを取得
      // デモ用のモックデータ
      setTimeout(() => {
        const mockData: LeaderboardEntry[] = Array.from({ length: 20 }, (_, i) => ({
          rank: i + 1,
          principal: `2vxsx-${Math.random().toString(36).substr(2, 5)}`,
          username: `Player${i + 1}`,
          score: Math.floor(Math.random() * 1000) + 100,
          gamesPlayed: Math.floor(Math.random() * 100) + 10,
          photosUploaded: Math.floor(Math.random() * 50),
          totalRewards: Math.floor(Math.random() * 500) + 50,
        })).sort((a, b) => b.score - a.score);

        setData(mockData);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const getRankEmoji = (rank: number) => {
      switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return `#${rank}`;
      }
    };

    return (
      <View style={[styles.entryContainer, item.rank <= 3 && styles.topEntry]}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{getRankEmoji(item.rank)}</Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.username}>
            {item.username || `${item.principal.slice(0, 8)}...`}
          </Text>
          <Text style={styles.stats}>
            {item.gamesPlayed} games • {item.photosUploaded} photos
          </Text>
        </View>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>{item.score}</Text>
          <Text style={styles.rewards}>{item.totalRewards} SPOT</Text>
        </View>
      </View>
    );
  };

  const tabs: { key: LeaderboardType; label: string }[] = [
    { key: 'players', label: 'Players' },
    { key: 'uploaders', label: 'Uploaders' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              selectedType === tab.key && styles.activeTab,
            ]}
            onPress={() => setSelectedType(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                selectedType === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3282b8" />
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.principal}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3282b8',
  },
  tabText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#3282b8',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
  },
  entryContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  topEntry: {
    borderWidth: 1,
    borderColor: '#3282b8',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3282b8',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  stats: {
    fontSize: 12,
    color: '#94a3b8',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  rewards: {
    fontSize: 12,
    color: '#94a3b8',
  },
});