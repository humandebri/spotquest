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
import { photoServiceV2 } from '../../services/photoV2';
import { CustomPrincipal } from '../../utils/principal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper function to calculate distance between two coordinates in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface RoundData {
  sessionId: string;
  photoId: number;
  score: number;
  distance: number;
  time: number; // Duration in seconds
  guessLocation?: { lat: number; lon: number };
  actualLocation?: { lat: number; lon: number };
  timestamp: number;
}

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
  medianDistance: number;
  percentile95Distance: number;
  bestAccuracy: number;
  perfectGuesses: number;
  accuracyDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  
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
    averageDistance: number;
  }>;
  
  // Category performance
  categoryStats: Array<{
    category: string; // difficulty level, scene type, etc.
    gamesPlayed: number;
    averageScore: number;
    winRate: number;
  }>;
  
  // Recent performance (last 30 days)
  recentPerformance: {
    gamesPlayed: number;
    averageScore: number;
    trend: 'up' | 'down' | 'stable';
    dailyStats: Array<{
      date: string;
      gamesPlayed: number;
      averageScore: number;
    }>;
  };
  
  // Elo progression
  eloHistory: Array<{
    date: number;
    rating: number;
    change: number;
  }>;
  
  // Speed vs Accuracy
  speedAccuracyData: Array<{
    time: number;
    distance: number;
    score: number;
  }>;
  
  // Ranking percentile
  rankingPercentile: number; // e.g., top 5%
  
  // Worst rounds for replay
  worstRounds: RoundData[];
}

export default function DetailedStatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { identity } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'accuracy' | 'performance' | 'rankings' | 'learning'>('overview');

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
      
      const principal = identity.getPrincipal();
      const principalText = principal.toString();
      
      // Fetch multiple data sources in parallel
      const [playerStats, recentSessions, leaderboard, eloLeaderboard] = await Promise.all([
        gameService.getPlayerStats(CustomPrincipal.fromText(principalText)),
        gameService.getRecentSessionsWithScores(CustomPrincipal.fromText(principalText), 50),
        gameService.getLeaderboard(100),
        gameService.getEloLeaderboardWithStats(100),
      ]);
      
      // Calculate percentile ranking
      let rankingPercentile = 0;
      if (playerStats && playerStats.rank) {
        const totalPlayers = leaderboard.length;
        rankingPercentile = ((totalPlayers - Number(playerStats.rank) + 1) / totalPlayers) * 100;
      }
      
      // Process session data for detailed analytics
      let roundsData: RoundData[] = [];
      let eloHistory: Array<{ date: number; rating: number; change: number }> = [];
      let speedAccuracyData: Array<{ time: number; distance: number; score: number }> = [];
      
      if (recentSessions.ok) {
        // Extract Elo history from sessions
        recentSessions.ok.forEach((session: any) => {
          if (session.initialEloRating?.length > 0 && session.finalEloRating?.length > 0) {
            eloHistory.push({
              date: Number(session.createdAt) / 1_000_000, // Convert to milliseconds
              rating: Number(session.finalEloRating[0]),
              change: Number(session.finalEloRating[0]) - Number(session.initialEloRating[0]),
            });
          }
        });
        
        // Sort Elo history by date
        eloHistory.sort((a, b) => a.date - b.date);
        
        // Get full session details to extract rounds data
        const sessionPromises = recentSessions.ok
          .filter((session: any) => session.status === 'Completed')
          .slice(0, 20) // Limit to last 20 completed sessions for performance
          .map((session: any) => gameService.getSession(session.id));
        
        const fullSessions = await Promise.all(sessionPromises);
        
        // Extract rounds data from sessions
        for (const sessionResult of fullSessions) {
          if (sessionResult?.ok) {
            const session = sessionResult.ok;
            for (let i = 0; i < session.rounds.length; i++) {
              const round = session.rounds[i];
              if (round.status === 'Completed' && round.guessData?.length > 0) {
                const guessData = round.guessData[0];
                const photoId = Number(round.photoId);
                
                // This will store the actual distance once we get photo metadata
                roundsData.push({
                  sessionId: session.id,
                  photoId: photoId,
                  score: Number(round.score),
                  distance: 0, // Will be calculated later with photo metadata
                  time: round.endTime?.length > 0 ? 
                    Number(round.endTime[0] - round.startTime) / 1_000_000_000 : 0,
                  guessLocation: { lat: guessData.lat, lon: guessData.lon },
                  timestamp: Number(round.startTime),
                });
              }
            }
          }
        }
      }
      
      // Fetch photo metadata for category analysis
      const uniquePhotoIds = [...new Set(roundsData.map(r => r.photoId))];
      const photoMetadataPromises = uniquePhotoIds.map(id => 
        photoServiceV2.getPhotoMetadata(BigInt(id), identity)
      );
      const photoMetadataResults = await Promise.all(photoMetadataPromises);
      
      // Create photo metadata map
      const photoMetadataMap = new Map();
      uniquePhotoIds.forEach((id, index) => {
        if (photoMetadataResults[index]) {
          photoMetadataMap.set(id, photoMetadataResults[index]);
        }
      });
      
      // Calculate region stats
      const regionStatsMap = new Map<string, {
        gamesPlayed: number;
        totalScore: number;
        totalDistance: number;
      }>();
      
      // Calculate difficulty stats (category stats)
      const difficultyStatsMap = new Map<string, {
        gamesPlayed: number;
        totalScore: number;
        wins: number;
      }>();
      
      // Calculate actual distances and process rounds for category analysis
      roundsData.forEach(round => {
        const metadata = photoMetadataMap.get(round.photoId);
        if (metadata && round.guessLocation) {
          // Calculate actual distance between guess and photo location
          const actualDistance = calculateDistance(
            round.guessLocation.lat,
            round.guessLocation.lon,
            metadata.latitude,
            metadata.longitude
          );
          round.distance = actualDistance;
          
          // Update region stats
          const region = metadata.region || 'Unknown';
          const regionStat = regionStatsMap.get(region) || {
            gamesPlayed: 0,
            totalScore: 0,
            totalDistance: 0,
          };
          regionStat.gamesPlayed++;
          regionStat.totalScore += round.score;
          regionStat.totalDistance += actualDistance;
          regionStatsMap.set(region, regionStat);
          
          // Update difficulty stats
          let difficultyName = 'Unknown';
          if (metadata.difficulty.EASY) difficultyName = 'Easy';
          else if (metadata.difficulty.NORMAL) difficultyName = 'Normal';
          else if (metadata.difficulty.HARD) difficultyName = 'Hard';
          else if (metadata.difficulty.EXTREME) difficultyName = 'Extreme';
          
          const difficultyStat = difficultyStatsMap.get(difficultyName) || {
            gamesPlayed: 0,
            totalScore: 0,
            wins: 0,
          };
          difficultyStat.gamesPlayed++;
          difficultyStat.totalScore += round.score;
          // Consider a "win" as scoring above 3000 points
          if (round.score > 3000) difficultyStat.wins++;
          difficultyStatsMap.set(difficultyName, difficultyStat);
        }
      });
      
      // Populate speed vs accuracy data with actual distances
      speedAccuracyData = roundsData
        .filter(round => round.time > 0 && round.distance > 0)
        .map(round => ({
          time: round.time,
          distance: round.distance,
          score: round.score,
        }));
      
      // Convert maps to arrays
      const regionStats = Array.from(regionStatsMap.entries()).map(([region, stats]) => ({
        region,
        gamesPlayed: stats.gamesPlayed,
        averageScore: stats.totalScore / stats.gamesPlayed,
        averageDistance: stats.totalDistance / stats.gamesPlayed,
      })).sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 10); // Top 10 regions
      
      const categoryStats = Array.from(difficultyStatsMap.entries()).map(([category, stats]) => ({
        category,
        gamesPlayed: stats.gamesPlayed,
        averageScore: stats.totalScore / stats.gamesPlayed,
        winRate: (stats.wins / stats.gamesPlayed) * 100,
      })).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
      
      // Calculate accuracy distribution
      const distances = roundsData.map(r => r.distance).filter(d => d > 0);
      distances.sort((a, b) => a - b);
      
      const medianDistance = distances.length > 0 ? distances[Math.floor(distances.length / 2)] : 0;
      const percentile95Distance = distances.length > 0 ? distances[Math.floor(distances.length * 0.95)] : 0;
      
      // Create accuracy distribution buckets
      const accuracyDistribution = [
        { range: '0-10km', count: 0, percentage: 0 },
        { range: '10-50km', count: 0, percentage: 0 },
        { range: '50-100km', count: 0, percentage: 0 },
        { range: '100-500km', count: 0, percentage: 0 },
        { range: '500km+', count: 0, percentage: 0 },
      ];
      
      distances.forEach(distance => {
        if (distance <= 10) accuracyDistribution[0].count++;
        else if (distance <= 50) accuracyDistribution[1].count++;
        else if (distance <= 100) accuracyDistribution[2].count++;
        else if (distance <= 500) accuracyDistribution[3].count++;
        else accuracyDistribution[4].count++;
      });
      
      const totalDistances = distances.length || 1;
      accuracyDistribution.forEach(bucket => {
        bucket.percentage = (bucket.count / totalDistances) * 100;
      });
      
      if (playerStats) {
        const detailedStats: DetailedStats = {
          totalGamesPlayed: Number(playerStats.totalGamesPlayed),
          gamesWon: Math.floor(Number(playerStats.totalGamesPlayed) * playerStats.winRate),
          gamesAbandoned: 0,
          winRate: playerStats.winRate * 100,
          
          totalScore: Number(playerStats.totalRewardsEarned || 0),
          averageScore: Number(playerStats.averageScore || 0),
          bestScore: Number(playerStats.bestScore || 0),
          
          totalPlayTime: Number(playerStats.averageDuration) * Number(playerStats.totalGamesPlayed) / 1_000_000_000,
          averageGameDuration: Number(playerStats.averageDuration) / 1_000_000_000,
          fastestGame: 0,
          
          averageDistance: distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0,
          medianDistance,
          percentile95Distance,
          bestAccuracy: distances.length > 0 ? Math.min(...distances) : 0,
          perfectGuesses: distances.filter(d => d < 0.5).length,
          accuracyDistribution,
          
          photosUploaded: Number(playerStats.totalPhotosUploaded),
          photoPlays: 0,
          photoAverageScore: 0,
          
          currentStreak: Number(playerStats.currentStreak),
          longestStreak: Number(playerStats.longestStreak),
          
          regionStats,
          categoryStats,
          
          recentPerformance: {
            gamesPlayed: recentSessions.ok?.length || 0,
            averageScore: playerStats.averageScore30Days ? Number(playerStats.averageScore30Days) : Number(playerStats.averageScore),
            trend: playerStats.averageScore30Days && Number(playerStats.averageScore30Days) > Number(playerStats.averageScore) ? 'up' : 
                   playerStats.averageScore30Days && Number(playerStats.averageScore30Days) < Number(playerStats.averageScore) ? 'down' : 'stable',
            dailyStats: [],
          },
          
          eloHistory,
          speedAccuracyData,
          rankingPercentile,
          worstRounds: roundsData.sort((a, b) => a.score - b.score).slice(0, 5),
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

  const renderOverviewTab = () => {
    // Prepare data for pie chart
    const pieData = stats ? [
      {
        key: 'won',
        value: stats.gamesWon,
        svg: { fill: '#4ECDC4' },
        label: 'Won',
      },
      {
        key: 'lost',
        value: stats.totalGamesPlayed - stats.gamesWon - stats.gamesAbandoned,
        svg: { fill: '#FF6B6B' },
        label: 'Lost',
      },
      {
        key: 'abandoned',
        value: stats.gamesAbandoned,
        svg: { fill: '#666' },
        label: 'Abandoned',
      },
    ].filter(item => item.value > 0) : [];

    return (
      <View style={styles.tabContent}>
        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={styles.statValue}>{stats?.gamesWon || 0}</Text>
            <Text style={styles.statLabel}>Games Won</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.progressCircleContainer}>
              {/* Custom Progress Circle */}
              <View style={styles.progressCircleOuter}>
                <View 
                  style={[
                    styles.progressCircleInner,
                    { 
                      height: 54 - ((stats?.winRate || 0) / 100) * 54,
                      backgroundColor: 'rgba(78, 205, 196, 0.2)'
                    }
                  ]} 
                />
                <Text style={styles.progressCircleText}>{stats?.winRate.toFixed(0) || 0}%</Text>
              </View>
            </View>
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

        {/* Game Outcome Distribution */}
        {pieData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Outcomes</Text>
            <View style={styles.chartCard}>
              {/* Custom Bar Chart */}
              <View style={styles.outcomeChart}>
                {pieData.map((item) => {
                  const percentage = stats ? (item.value / stats.totalGamesPlayed) * 100 : 0;
                  return (
                    <View key={item.key} style={styles.outcomeBar}>
                      <View style={styles.outcomeBarLabel}>
                        <Text style={styles.outcomeBarLabelText}>{item.label}</Text>
                        <Text style={styles.outcomeBarValue}>{item.value}</Text>
                      </View>
                      <View style={styles.outcomeBarTrack}>
                        <View 
                          style={[
                            styles.outcomeBarFill,
                            { 
                              width: `${percentage}%`,
                              backgroundColor: item.svg.fill
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

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

        {/* Streak Visualization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streak History</Text>
          <View style={styles.streakCard}>
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Ionicons name="flame" size={32} color="#FF8E53" />
                <Text style={styles.streakValue}>{stats?.currentStreak || 0}</Text>
                <Text style={styles.streakLabel}>Current</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Ionicons name="trophy" size={32} color="#FFD700" />
                <Text style={styles.streakValue}>{stats?.longestStreak || 0}</Text>
                <Text style={styles.streakLabel}>Longest</Text>
              </View>
            </View>
            <View style={styles.streakProgressContainer}>
              <View style={styles.streakProgressBar}>
                <View 
                  style={[
                    styles.streakProgressFill,
                    { 
                      width: stats?.longestStreak 
                        ? `${(stats.currentStreak / stats.longestStreak) * 100}%` 
                        : '0%' 
                    }
                  ]} 
                />
              </View>
              <Text style={styles.streakProgressText}>
                {stats?.longestStreak && stats.currentStreak >= stats.longestStreak 
                  ? '🔥 New Record!' 
                  : `${stats?.longestStreak ? stats.longestStreak - stats.currentStreak : 0} more to beat record`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderAccuracyTab = () => {
    const accuracyColors = ['#4ECDC4', '#95E1D3', '#F38181', '#EAFFD0', '#FF6B6B'];
    
    return (
      <View style={styles.tabContent}>
        {/* Key Accuracy Metrics */}
        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Ionicons name="location" size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{stats?.averageDistance.toFixed(1) || 0} km</Text>
            <Text style={styles.statLabel}>平均誤差</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="analytics" size={24} color="#8b5cf6" />
            <Text style={styles.statValue}>{stats?.medianDistance.toFixed(1) || 0} km</Text>
            <Text style={styles.statLabel}>中央値</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{stats?.percentile95Distance.toFixed(1) || 0} km</Text>
            <Text style={styles.statLabel}>95%タイル</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="pin" size={24} color="#FFD700" />
            <Text style={styles.statValue}>{stats?.perfectGuesses || 0}</Text>
            <Text style={styles.statLabel}>Perfect &lt;0.5km</Text>
          </View>
        </View>

        {/* Accuracy Distribution Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>誤差分布ヒストグラム</Text>
          <View style={styles.chartCard}>
            <View style={styles.verticalBarsContainer}>
              {stats?.accuracyDistribution.map((item, index) => {
                const maxValue = Math.max(...(stats?.accuracyDistribution.map(d => d.percentage) || [1]));
                const heightPercentage = (item.percentage / maxValue) * 100;
                return (
                  <View key={index} style={styles.verticalBarWrapper}>
                    <View style={styles.verticalBarColumn}>
                      <Text style={styles.verticalBarValue}>{item.percentage.toFixed(0)}%</Text>
                      <View style={styles.verticalBarTrack}>
                        <View 
                          style={[
                            styles.verticalBarFill,
                            { 
                              height: `${heightPercentage}%`,
                              backgroundColor: accuracyColors[index]
                            }
                          ]} 
                        />
                      </View>
                    </View>
                    <Text style={styles.verticalBarLabel}>{item.range}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Accuracy Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>精度インサイト</Text>
          <View style={styles.insightCard}>
            <View style={styles.insightRow}>
              <Ionicons name="checkmark-circle" size={20} color="#4ECDC4" />
              <Text style={styles.insightText}>
                あなたの平均誤差は{stats?.averageDistance.toFixed(1) || 0}kmです
              </Text>
            </View>
            {stats && stats.perfectGuesses > 0 && (
              <View style={styles.insightRow}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.insightText}>
                  {stats.perfectGuesses}回のパーフェクト推測（0.5km以内）を達成！
                </Text>
              </View>
            )}
            {stats && stats.medianDistance < stats.averageDistance && (
              <View style={styles.insightRow}>
                <Ionicons name="information-circle" size={20} color="#8b5cf6" />
                <Text style={styles.insightText}>
                  外れ値が平均を押し上げています（中央値の方が低い）
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderPerformanceTab = () => {
    return (
      <View style={styles.tabContent}>
        {/* Elo Rating Progression */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eloレーティング推移</Text>
          <View style={styles.chartCard}>
            {stats?.eloHistory && stats.eloHistory.length > 1 ? (
              <View style={styles.lineChartContainer}>
                <Text style={styles.chartLabel}>
                  初期: {stats.eloHistory[0].rating} → 現在: {stats.eloHistory[stats.eloHistory.length - 1].rating}
                </Text>
                <View style={styles.eloChart}>
                  {stats.eloHistory.map((point, index) => {
                    const isPositive = point.change > 0;
                    return (
                      <View key={index} style={styles.eloPoint}>
                        <Text style={[styles.eloChange, { color: isPositive ? '#4ECDC4' : '#FF6B6B' }]}>
                          {isPositive ? `+${point.change}` : `${point.change}`}
                        </Text>
                        <Text style={styles.eloRating}>{point.rating}</Text>
                        <Text style={styles.eloDate}>
                          {new Date(point.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                        </Text>
                      </View>
                    );
                  }).slice(-10)}
                </View>
              </View>
            ) : (
              <Text style={styles.noDataText}>データが不足しています</Text>
            )}
          </View>
        </View>

        {/* Speed vs Accuracy Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>スピード vs 精度分析</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightSubtitle}>推測時間と誤差の相関</Text>
            <View style={styles.insightRow}>
              <Ionicons name="speedometer" size={20} color="#4ECDC4" />
              <Text style={styles.insightText}>
                平均推測時間: {stats?.averageGameDuration.toFixed(0) || 0}秒
              </Text>
            </View>
            <View style={styles.insightRow}>
              <Ionicons name="timer" size={20} color="#f59e0b" />
              <Text style={styles.insightText}>
                最速ゲーム: {stats?.fastestGame || 0}秒
              </Text>
            </View>
            {stats && stats.averageGameDuration > 180 && (
              <View style={styles.insightRow}>
                <Ionicons name="information-circle" size={20} color="#8b5cf6" />
                <Text style={styles.insightText}>
                  考えすぎの傾向があります（平均3分以上）
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Performance Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>パフォーマンストレンド</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>過去30日の平均スコア</Text>
              <Text style={styles.performanceValue}>
                {stats?.recentPerformance.averageScore.toFixed(0) || 0}
              </Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>全期間平均スコア</Text>
              <Text style={styles.performanceValue}>{stats?.averageScore.toFixed(0) || 0}</Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>トレンド</Text>
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
                  {stats?.recentPerformance.trend === 'up' ? '上昇中' : 
                   stats?.recentPerformance.trend === 'down' ? '下降中' : '安定'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderRankingsTab = () => {
    return (
      <View style={styles.tabContent}>
        {/* Ranking Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ランキング概要</Text>
          <View style={styles.rankingCard}>
            <View style={styles.rankingHeader}>
              <Ionicons name="trophy" size={48} color="#FFD700" />
              <View style={styles.rankingInfo}>
                <Text style={styles.rankingPercentile}>
                  上位 {stats?.rankingPercentile.toFixed(1) || '--'}%
                </Text>
                <Text style={styles.rankingLabel}>全プレイヤー中</Text>
              </View>
            </View>
            {stats && stats.rankingPercentile <= 10 && (
              <View style={styles.rankingBadge}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.rankingBadgeText}>トップ10%プレイヤー</Text>
              </View>
            )}
          </View>
        </View>

        {/* Detailed Rankings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>詳細ランキング</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>Eloレーティング</Text>
              <Text style={styles.performanceValue}>{stats?.eloHistory[stats.eloHistory.length - 1]?.rating || 1500}</Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>ベストスコア</Text>
              <Text style={styles.performanceValue}>{stats?.bestScore.toLocaleString() || 0}</Text>
            </View>
            <View style={styles.performanceRow}>
              <Text style={styles.performanceLabel}>総獲得SPOT</Text>
              <Text style={styles.performanceValue}>{((stats?.totalScore || 0) / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Achievements Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>実績進捗</Text>
          <View style={styles.achievementGrid}>
            <View style={styles.achievementCard}>
              <Ionicons name="flame" size={32} color="#FF8E53" />
              <Text style={styles.achievementValue}>{stats?.longestStreak || 0}</Text>
              <Text style={styles.achievementLabel}>最長連続勝利</Text>
            </View>
            <View style={styles.achievementCard}>
              <Ionicons name="camera" size={32} color="#8b5cf6" />
              <Text style={styles.achievementValue}>{stats?.photosUploaded || 0}</Text>
              <Text style={styles.achievementLabel}>写真投稿数</Text>
            </View>
            <View style={styles.achievementCard}>
              <Ionicons name="pin" size={32} color="#FFD700" />
              <Text style={styles.achievementValue}>{stats?.perfectGuesses || 0}</Text>
              <Text style={styles.achievementLabel}>完璧な推測</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderLearningTab = () => {
    return (
      <View style={styles.tabContent}>
        {/* Worst Rounds for Replay */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>改善が必要なラウンド</Text>
          <Text style={styles.sectionSubtitle}>最も誤差の大きかったラウンドで再挑戦しましょう</Text>
          {stats?.worstRounds && stats.worstRounds.length > 0 ? (
            <View style={styles.replayList}>
              {stats.worstRounds.map((round, index) => (
                <TouchableOpacity key={index} style={styles.replayCard}>
                  <View style={styles.replayInfo}>
                    <Text style={styles.replayRank}>#{index + 1}</Text>
                    <View style={styles.replayDetails}>
                      <Text style={styles.replayScore}>スコア: {round.score}</Text>
                      <Text style={styles.replayDistance}>誤差: {round.distance.toFixed(1)}km</Text>
                    </View>
                  </View>
                  <View style={styles.replayAction}>
                    <Ionicons name="refresh" size={20} color="#4ECDC4" />
                    <Text style={styles.replayActionText}>再挑戦</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>データがありません</Text>
          )}
        </View>

        {/* Category Performance Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>カテゴリ別パフォーマンス</Text>
          
          {/* Difficulty Level Performance */}
          <View style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>難易度別統計</Text>
            {stats?.categoryStats && stats.categoryStats.length > 0 ? (
              <View style={styles.categoryList}>
                {stats.categoryStats.map((cat, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <Text style={[
                        styles.categoryLabel,
                        { color: cat.category === 'Easy' ? '#4ECDC4' : 
                                cat.category === 'Normal' ? '#95E1D3' :
                                cat.category === 'Hard' ? '#f59e0b' : '#FF6B6B' }
                      ]}>
                        {cat.category}
                      </Text>
                      <Text style={styles.categoryGames}>{cat.gamesPlayed}ゲーム</Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <Text style={styles.categoryScore}>平均: {cat.averageScore.toFixed(0)}</Text>
                      <Text style={styles.categoryWinRate}>勝率: {cat.winRate.toFixed(1)}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>データがありません</Text>
            )}
          </View>
          
          {/* Region Performance */}
          <View style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>地域別統計 (上位10)</Text>
            {stats?.regionStats && stats.regionStats.length > 0 ? (
              <View style={styles.categoryList}>
                {stats.regionStats.map((region, index) => (
                  <View key={index} style={styles.categoryRow}>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryLabel}>{region.region}</Text>
                      <Text style={styles.categoryGames}>{region.gamesPlayed}ゲーム</Text>
                    </View>
                    <View style={styles.categoryStats}>
                      <Text style={styles.categoryScore}>平均: {region.averageScore.toFixed(0)}</Text>
                      <Text style={styles.categoryDistance}>誤差: {region.averageDistance.toFixed(1)}km</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>データがありません</Text>
            )}
          </View>
        </View>

        {/* Learning Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>学習インサイト</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightSubtitle}>あなたの弱点分析</Text>
            {stats && stats.averageDistance > 100 && (
              <View style={styles.insightRow}>
                <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
                <Text style={styles.insightText}>
                  平均誤差が100km以上です。地理的な特徴をより注意深く観察しましょう
                </Text>
              </View>
            )}
            {stats && stats.fastestGame < 30 && (
              <View style={styles.insightRow}>
                <Ionicons name="speedometer" size={20} color="#f59e0b" />
                <Text style={styles.insightText}>
                  推測が速すぎる可能性があります。もう少し時間をかけて分析しましょう
                </Text>
              </View>
            )}
            {stats && stats.categoryStats && (() => {
              const hardExtreme = stats.categoryStats.filter(c => c.category === 'Hard' || c.category === 'Extreme');
              const easyNormal = stats.categoryStats.filter(c => c.category === 'Easy' || c.category === 'Normal');
              if (hardExtreme.length > 0 && easyNormal.length > 0) {
                const hardAvg = hardExtreme.reduce((sum, c) => sum + c.averageScore, 0) / hardExtreme.length;
                const easyAvg = easyNormal.reduce((sum, c) => sum + c.averageScore, 0) / easyNormal.length;
                if (hardAvg < easyAvg * 0.7) {
                  return (
                    <View style={styles.insightRow}>
                      <Ionicons name="trending-up" size={20} color="#f59e0b" />
                      <Text style={styles.insightText}>
                        高難易度の写真で苦戦しています。難しい写真により多く挑戦しましょう
                      </Text>
                    </View>
                  );
                }
              }
              return null;
            })()}
            <View style={styles.insightRow}>
              <Ionicons name="bulb" size={20} color="#4ECDC4" />
              <Text style={styles.insightText}>
                ヒント：道路標識、植生、建築様式に注目すると精度が向上します
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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


        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ height: 48 }}
          >
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
              onPress={() => setSelectedTab('overview')}
            >
              <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
                概要
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'accuracy' && styles.activeTab]}
              onPress={() => setSelectedTab('accuracy')}
            >
              <Text style={[styles.tabText, selectedTab === 'accuracy' && styles.activeTabText]}>
                精度
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'performance' && styles.activeTab]}
              onPress={() => setSelectedTab('performance')}
            >
              <Text style={[styles.tabText, selectedTab === 'performance' && styles.activeTabText]}>
                パフォーマンス
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'rankings' && styles.activeTab]}
              onPress={() => setSelectedTab('rankings')}
            >
              <Text style={[styles.tabText, selectedTab === 'rankings' && styles.activeTabText]}>
                ランキング
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'learning' && styles.activeTab]}
              onPress={() => setSelectedTab('learning')}
            >
              <Text style={[styles.tabText, selectedTab === 'learning' && styles.activeTabText]}>
                学習
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'accuracy' && renderAccuracyTab()}
          {selectedTab === 'performance' && renderPerformanceTab()}
          {selectedTab === 'rankings' && renderRankingsTab()}
          {selectedTab === 'learning' && renderLearningTab()}
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
    marginTop: 4,
    marginBottom: 4,
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
  tabsContainer: {
    marginBottom: 12,
    height: 48,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    height: 40,
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginRight: 4,
    minWidth: 60,
    height: 32,
  },
  activeTab: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4ECDC4',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
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
  progressCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4ECDC4',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  progressCircleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    zIndex: 1,
  },
  chartCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  streakDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakProgressContainer: {
    marginTop: 8,
  },
  streakProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  streakProgressFill: {
    height: '100%',
    backgroundColor: '#FF8E53',
    borderRadius: 4,
  },
  streakProgressText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  photoStatsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  photoStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  photoStatItem: {
    alignItems: 'center',
  },
  photoStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  photoStatLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  outcomeChart: {
    gap: 16,
  },
  outcomeBar: {
    gap: 8,
  },
  outcomeBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  outcomeBarLabelText: {
    fontSize: 14,
    color: '#fff',
  },
  outcomeBarValue: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  outcomeBarTrack: {
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  outcomeBarFill: {
    height: '100%',
    borderRadius: 12,
  },
  verticalBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingHorizontal: 10,
  },
  verticalBarWrapper: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  verticalBarColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 160,
    width: '80%',
  },
  verticalBarValue: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
    marginBottom: 4,
  },
  verticalBarTrack: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  verticalBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  verticalBarLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  lineChartContainer: {
    padding: 16,
  },
  chartLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
    textAlign: 'center',
  },
  eloChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  eloPoint: {
    alignItems: 'center',
    flex: 1,
  },
  eloChange: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  eloRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  eloDate: {
    fontSize: 10,
    color: '#666',
    transform: [{ rotate: '-45deg' }],
    marginTop: 8,
  },
  rankingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  rankingInfo: {
    alignItems: 'center',
  },
  rankingPercentile: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  rankingLabel: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  rankingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rankingBadgeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  achievementGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  achievementValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  achievementLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  replayList: {
    gap: 12,
  },
  replayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  replayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  replayRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  replayDetails: {
    gap: 4,
  },
  replayScore: {
    fontSize: 14,
    color: '#fff',
  },
  replayDistance: {
    fontSize: 12,
    color: '#999',
  },
  replayAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  replayActionText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  categoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  categoryInfo: {
    flexDirection: 'column',
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoryGames: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryStats: {
    alignItems: 'flex-end',
  },
  categoryScore: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  categoryWinRate: {
    fontSize: 12,
    color: '#95E1D3',
    marginTop: 2,
  },
  categoryDistance: {
    fontSize: 12,
    color: '#95E1D3',
    marginTop: 2,
  },
});