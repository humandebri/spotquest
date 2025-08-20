import React, { useState, useEffect, useCallback } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';
import { CustomPrincipal } from '../../utils/principal';

interface LeaderboardEntry {
  rank: number;
  principal: string;
  username?: string;
  score: number;
  gamesPlayed?: number;
  photosUploaded?: number;
  totalRewards?: number;
  change?: number;
  isPro?: boolean;
}

interface PhotoLeaderboardEntry {
  rank: number;
  photoId: number;
  owner: string;
  timesUsed: number;
  title: string;
}

interface UploaderLeaderboardEntry {
  rank: number;
  principal: string;
  username?: string;
  totalPhotos: number;
  totalTimesUsed: number;
  isPro?: boolean;
}

type LeaderboardType = 'global' | 'uploaders' | 'weekly' | 'monthly';

export default function LeaderboardScreen({ navigation }: any) {
  const auth = useAuth();
  const [selectedType, setSelectedType] = useState<LeaderboardType>('global');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    // Clear data immediately when tab changes to prevent stale data display
    setData([]);
    setUserStats(null);
    setUserRank(null);
    loadLeaderboard();
  }, [selectedType]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🏆 LeaderboardScreen focused, refreshing data...');
      loadLeaderboard();
    }, [selectedType])
  );

  const loadLeaderboard = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      console.log('🏆 Auth state:', { isAuthenticated: auth?.isAuthenticated, hasIdentity: !!auth?.identity });
      
      // Initialize game service if authenticated
      if (auth && auth.identity) {
        console.log('🏆 Initializing game service...');
        await gameService.init(auth.identity);
        
        // Debug: Check player's own stats to see if they exist in the system
        const myPrincipal = auth.identity.getPrincipal();
        console.log('🏆 My principal:', myPrincipal.toString());
        try {
          const myStats = await gameService.getPlayerStats(myPrincipal as any);
          console.log('🏆 My player stats:', myStats);
        } catch (e) {
          console.log('🏆 Could not get my stats:', e);
        }
      } else {
        console.log('🏆 Loading without authentication');
      }

      // Debug: Log backend connection status
      console.log('🏆 Backend status check:', {
        serviceInitialized: gameService.isInitialized,
        selectedType,
        timestamp: new Date().toISOString(),
      });

      console.log('🏆 Loading leaderboard for type:', selectedType);
      let leaderboardData: any[] = [];
      
      switch (selectedType) {
        case 'global':
          // Get player leaderboard with Elo ratings
          const playerLeaderboard = await gameService.getEloLeaderboardWithStats(50);
          console.log('🏆 Global Elo leaderboard loaded:', playerLeaderboard.length, 'players');
          
          // Debug: Check session finalization status for top players
          if (auth && auth.identity && playerLeaderboard.length > 0) {
            try {
              const topPlayerPrincipal = playerLeaderboard[0].principal;
              const sessionsResult = await gameService.getUserSessions(topPlayerPrincipal);
              if (sessionsResult.ok && sessionsResult.ok.length > 0) {
                console.log(`🏆 Top player ${topPlayerPrincipal.toString().slice(0, 10)}... has ${sessionsResult.ok.length} sessions`);
                console.log(`🏆 Session statuses:`, sessionsResult.ok.map(s => s.status));
              }
            } catch (e) {
              console.log('🏆 Could not check session status:', e);
            }
          }
          // Debug: Check reward values
          if (playerLeaderboard.length > 0) {
            console.log('🏆 Sample player rewards:', playerLeaderboard[0].totalRewards, 'raw value');
            console.log('🏆 First player full data:', playerLeaderboard[0]);
            // Check first 5 players' rewards
            playerLeaderboard.slice(0, 5).forEach((player, index) => {
              console.log(`🏆 Player ${index + 1} - Principal: ${player.principal.toString().slice(0, 10)}... Rewards: ${player.totalRewards}`);
            });
          }
          // Fetch Pro status for all players in parallel
          const proStatusPromises = playerLeaderboard.map(entry => 
            gameService.getProMembershipStatus(entry.principal as any)
              .then(status => ({ principal: entry.principal.toString(), isPro: status?.isPro || false }))
              .catch(() => ({ principal: entry.principal.toString(), isPro: false }))
          );
          
          const proStatuses = await Promise.all(proStatusPromises);
          const proStatusMap = new Map(proStatuses.map(s => [s.principal, s.isPro]));
          
          leaderboardData = playerLeaderboard.map((entry, index) => ({
            rank: index + 1,
            principal: entry.principal.toString(),
            username: entry.username,
            score: Number(entry.eloRating), // Use Elo rating as score
            gamesPlayed: Number(entry.gamesPlayed),
            photosUploaded: Number(entry.photosUploaded),
            totalRewards: Number(entry.totalRewards),
            isPro: proStatusMap.get(entry.principal.toString()) || false,
          }));
          
          break;
          
        case 'uploaders':
          // Get top uploaders
          const uploaders = await gameService.getTopUploaders(50);
          console.log('🏆 Uploaders leaderboard loaded:', uploaders.length, 'uploaders');
          
          // Fetch Pro status for all uploaders
          const uploaderProStatusPromises = uploaders.map(entry => 
            gameService.getProMembershipStatus(entry.principal as any)
              .then(status => ({ principal: entry.principal.toString(), isPro: status?.isPro || false }))
              .catch(() => ({ principal: entry.principal.toString(), isPro: false }))
          );
          
          const uploaderProStatuses = await Promise.all(uploaderProStatusPromises);
          const uploaderProStatusMap = new Map(uploaderProStatuses.map(s => [s.principal, s.isPro]));
          
          leaderboardData = uploaders.map((entry, index) => ({
            rank: index + 1,
            principal: entry.principal.toString(),
            username: entry.username,
            score: Number(entry.totalTimesUsed), // Use total times used as score
            totalPhotos: Number(entry.totalPhotos),
            totalTimesUsed: Number(entry.totalTimesUsed),
            isPro: uploaderProStatusMap.get(entry.principal.toString()) || false,
          }));
          break;
          
        case 'weekly':
          // Get weekly leaderboard (rewards from last 7 days)
          const weeklyLeaderboard = await gameService.getWeeklyLeaderboard(50);
          console.log('🏆 Weekly leaderboard loaded:', weeklyLeaderboard.length, 'players');
          
          // Fetch additional stats for each player
          const weeklyDataWithStats = await Promise.all(
            weeklyLeaderboard.map(async (entry, index) => {
              try {
                const [stats, proStatus] = await Promise.all([
                  gameService.getPlayerStats(entry.principal as any),
                  gameService.getProMembershipStatus(entry.principal as any)
                ]);
                return {
                  rank: index + 1,
                  principal: entry.principal.toString(),
                  username: entry.username || `${entry.principal.toString().slice(0, 8)}...`,
                  score: Number(entry.rewards), // Use weekly rewards as score
                  gamesPlayed: stats ? Number(stats.totalGamesPlayed) : 0,
                  photosUploaded: stats ? Number(stats.totalPhotosUploaded) : 0,
                  totalRewards: Number(entry.rewards), // This is weekly rewards
                  isPro: proStatus?.isPro || false,
                };
              } catch (error) {
                console.error(`Failed to get stats for ${entry.principal}:`, error);
                return {
                  rank: index + 1,
                  principal: entry.principal.toString(),
                  username: entry.username || `${entry.principal.toString().slice(0, 8)}...`,
                  score: Number(entry.rewards),
                  gamesPlayed: 0,
                  photosUploaded: 0,
                  totalRewards: Number(entry.rewards),
                  isPro: false,
                };
              }
            })
          );
          
          leaderboardData = weeklyDataWithStats;
          break;
          
        case 'monthly':
          // Get monthly leaderboard (rewards from last 30 days)
          const monthlyLeaderboard = await gameService.getMonthlyLeaderboard(50);
          console.log('🏆 Monthly leaderboard loaded:', monthlyLeaderboard.length, 'players');
          
          // Fetch additional stats for each player
          const monthlyDataWithStats = await Promise.all(
            monthlyLeaderboard.map(async (entry, index) => {
              try {
                const [stats, proStatus] = await Promise.all([
                  gameService.getPlayerStats(entry.principal as any),
                  gameService.getProMembershipStatus(entry.principal as any)
                ]);
                return {
                  rank: index + 1,
                  principal: entry.principal.toString(),
                  username: entry.username || `${entry.principal.toString().slice(0, 8)}...`,
                  score: Number(entry.rewards), // Use monthly rewards as score
                  gamesPlayed: stats ? Number(stats.totalGamesPlayed) : 0,
                  photosUploaded: stats ? Number(stats.totalPhotosUploaded) : 0,
                  totalRewards: Number(entry.rewards), // This is monthly rewards
                  isPro: proStatus?.isPro || false,
                };
              } catch (error) {
                console.error(`Failed to get stats for ${entry.principal}:`, error);
                return {
                  rank: index + 1,
                  principal: entry.principal.toString(),
                  username: entry.username || `${entry.principal.toString().slice(0, 8)}...`,
                  score: Number(entry.rewards),
                  gamesPlayed: 0,
                  photosUploaded: 0,
                  totalRewards: Number(entry.rewards),
                  isPro: false,
                };
              }
            })
          );
          
          leaderboardData = monthlyDataWithStats;
          break;
      }
      
      console.log('🏆 Leaderboard data loaded:', leaderboardData.length, 'items');
      setData(leaderboardData);
      
      // 🚀 並列実行による高速化: ユーザー統計を非同期で取得
      // UIの更新をブロックしない
      if (auth && auth.identity) {
        const principal = auth.identity.getPrincipal();
        gameService.getPlayerStats(principal as any)
          .then(stats => {
            console.log('🏆 Player stats received:', stats);
            if (stats) {
              setUserStats(stats);
              // Fix: Check for null/undefined explicitly, not falsy (0 is falsy but valid rank)
              const rankValue = stats.rank !== null && stats.rank !== undefined ? Number(stats.rank) : null;
              setUserRank(rankValue);
              console.log('🏆 User rank set to:', stats.rank, '-> parsed as:', rankValue);
            }
          })
          .catch(error => {
            console.error('Failed to fetch user stats:', error);
          });
      }
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      console.error('🏆 Failed to load leaderboard:', error);
      // Clear all state on error to prevent inconsistent data
      setData([]);
      setUserStats(null);
      setUserRank(null);
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

  const renderItem = ({ item }: { item: any }) => {
    
    // Render different content based on leaderboard type
    if (selectedType === 'uploaders' && 'totalPhotos' in item) {
      // Uploader leaderboard entry
      return (
        <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
          <View style={styles.rankContainer}>
            <Text style={styles.rankText}>#{item.rank}</Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.usernameContainer}>
              <Text style={styles.username}>
                {item.username || `${String(item.principal || 'Unknown').slice(0, 8)}...`}
              </Text>
              {item.isPro && (
                <MaterialCommunityIcons name="crown" size={16} color="#f59e0b" style={styles.proCrownIcon} />
              )}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="camera-outline" size={14} color="#94a3b8" />
                <Text style={styles.statText}>{item.totalPhotos} photos</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="play-circle-outline" size={14} color="#94a3b8" />
                <Text style={styles.statText}>{item.totalTimesUsed} plays</Text>
              </View>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>{item.totalTimesUsed}</Text>
            <Text style={styles.scoreLabel}>total plays</Text>
          </View>
        </TouchableOpacity>
      );
    } else {
      // Player leaderboard entry (global/weekly)
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
            <View style={styles.usernameContainer}>
              <Text style={styles.username}>
                {item.username || `${String(item.principal || 'Unknown').slice(0, 8)}...`}
              </Text>
              {item.isPro && (
                <MaterialCommunityIcons name="crown" size={16} color="#f59e0b" style={styles.proCrownIcon} />
              )}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="game-controller-outline" size={14} color="#94a3b8" />
                <Text style={styles.statText}>{item.gamesPlayed || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="camera-outline" size={14} color="#94a3b8" />
                <Text style={styles.statText}>{item.photosUploaded || 0}</Text>
              </View>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              {selectedType === 'weekly' || selectedType === 'monthly' 
                ? ((item.score || 0) / 100).toFixed(2) 
                : item.score}
            </Text>
            <Text style={styles.scoreLabel}>
              {selectedType === 'global' ? 'Elo Rating' : 
               selectedType === 'weekly' ? 'SPOT (7 days)' :
               selectedType === 'monthly' ? 'SPOT (30 days)' : 'points'}
            </Text>
            {selectedType === 'global' && (
              <View style={styles.rewardsContainer}>
                <Ionicons name="cash-outline" size={14} color="#f59e0b" />
                <Text style={styles.rewardsText}>{((item.totalRewards || 0) / 100).toFixed(2)}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Leaderboard</Text>
            <Text style={styles.subtitle}>Top players competing for glory</Text>
          </View>
        </View>

        {/* Your Rank Card */}
        {auth && auth.identity && userStats && (
          <View style={styles.rankCardContainer}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.rankCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.rankCardContent}>
                <View>
                  <Text style={styles.rankCardLabel}>
                    {selectedType === 'global' ? 'Your Rank' : 
                     selectedType === 'uploaders' ? 'Uploader Rank' :
                     selectedType === 'weekly' ? 'Weekly Rank' : 'Monthly Rank'}
                  </Text>
                  <Text style={styles.rankCardValue}>
                    {selectedType === 'uploaders' ? (
                      // Find user's position in uploaders list
                      (() => {
                        const userIndex = data.findIndex(item => item.principal === auth.identity?.getPrincipal().toString());
                        return userIndex >= 0 ? `#${userIndex + 1}` : 'N/A';
                      })()
                    ) : selectedType === 'weekly' || selectedType === 'monthly' ? (
                      // Find user's position in weekly/monthly list
                      (() => {
                        const userIndex = data.findIndex(item => item.principal === auth.identity?.getPrincipal().toString());
                        return userIndex >= 0 ? `#${userIndex + 1}` : 'Unranked';
                      })()
                    ) : (
                      (() => {
                        console.log('🏆 Rank Card Debug:', {
                          userRank,
                          typeofUserRank: typeof userRank,
                          isNull: userRank === null,
                          isUndefined: userRank === undefined,
                          truthyCheck: !!userRank
                        });
                        return userRank ? `#${userRank}` : 'Unranked';
                      })()
                    )}
                  </Text>
                  <View style={styles.rankCardChange}>
                    {selectedType === 'uploaders' ? (
                      <>
                        <Ionicons name="camera" size={16} color="#94a3b8" />
                        <Text style={styles.rankCardChangeText}>
                          {Number(userStats.totalPhotosUploaded)} photos uploaded
                        </Text>
                      </>
                    ) : selectedType === 'weekly' ? (
                      <>
                        <Ionicons name="calendar" size={16} color="#94a3b8" />
                        <Text style={styles.rankCardChangeText}>
                          Last 7 days activity
                        </Text>
                      </>
                    ) : selectedType === 'monthly' ? (
                      <>
                        <Ionicons name="calendar" size={16} color="#94a3b8" />
                        <Text style={styles.rankCardChangeText}>
                          Last 30 days • Avg: {Number(userStats.averageScore30Days || 0).toLocaleString()}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="game-controller" size={16} color="#94a3b8" />
                        <Text style={styles.rankCardChangeText}>
                          {Number(userStats.totalGamesPlayed)} games played
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.rankCardRight}>
                  <Text style={styles.rankCardLabel}>
                    {selectedType === 'uploaders' ? 'Photo Stats' :
                     selectedType === 'weekly' ? 'This Week' :
                     selectedType === 'monthly' ? 'This Month' : 
                     selectedType === 'global' ? 'Elo Rating' : 'Best Score'}
                  </Text>
                  <Text style={styles.rankCardScore}>
                    {selectedType === 'uploaders' ? (
                      (() => {
                        // Calculate total times photos were used
                        const myPrincipal = auth.identity?.getPrincipal().toString();
                        const uploaderData = data.find(item => item.principal === myPrincipal);
                        // Check if totalTimesUsed exists before using it
                        if (uploaderData && 'totalTimesUsed' in uploaderData) {
                          return uploaderData.totalTimesUsed.toLocaleString();
                        }
                        return '0';
                      })()
                    ) : selectedType === 'weekly' || selectedType === 'monthly' ? (
                      (() => {
                        // Show rewards from current leaderboard
                        const myPrincipal = auth.identity?.getPrincipal().toString();
                        const userData = data.find(item => item.principal === myPrincipal);
                        const rewards = userData && userData.score ? userData.score : 0;
                        return (rewards / 100).toFixed(2);
                      })()
                    ) : selectedType === 'global' ? (
                      userStats && userStats.eloRating !== undefined ? Number(userStats.eloRating) : '1500'
                    ) : (
                      Number(userStats.bestScore).toLocaleString()
                    )}
                  </Text>
                  <Text style={styles.rankCardRewards}>
                    {selectedType === 'uploaders' ? (
                      'total plays'
                    ) : selectedType === 'weekly' ? (
                      'SPOT earned (7 days)'
                    ) : selectedType === 'monthly' ? (
                      'SPOT earned (30 days)'
                    ) : selectedType === 'global' ? (
                      'rating points'
                    ) : (
                      `${(Number(userStats.totalRewardsEarned) / 100).toFixed(2)} SPOT`
                    )}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

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
                size={16} 
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
        ) : data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="trophy-outline" size={64} color="#475569" />
            <Text style={styles.emptyTitle}>
              {selectedType === 'global' || selectedType === 'weekly' 
                ? 'Limited Players' 
                : selectedType === 'uploaders' 
                ? 'Limited Uploaders' 
                : 'Limited Activity'}
            </Text>
            <Text style={styles.emptyMessage}>
              {selectedType === 'global' || selectedType === 'weekly'
                ? 'Complete some games to appear on the leaderboard!'
                : selectedType === 'uploaders'
                ? 'Upload photos and have them used in games to appear here!'
                : 'Photos need to be used in games to generate usage statistics.'}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => loadLeaderboard(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#ffffff" />
              <Text style={styles.emptyButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item, index) => {
              // Generate unique key based on type and data
              if (item.photoId !== undefined) {
                return `photo-${item.photoId}`;
              } else if (item.principal) {
                return `${selectedType}-${item.principal}-${index}`;
              } else if (item.owner) {
                return `owner-${item.owner}-${index}`;
              } else {
                return `item-${item.rank || index}`;
              }
            }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadLeaderboard(true)}
                tintColor="#3b82f6"
              />
            }
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
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
    marginBottom: 12,
    maxHeight: 40,
  },
  tabContent: {
    paddingRight: 20,
  },
  tab: {
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
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
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
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
  scoreLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proCrownIcon: {
    marginLeft: 6,
  },
});