import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAuth } from '../../hooks/useAuth';
import { gameService } from '../../services/game';
import { useGameStore } from '../../store/gameStore';
import { CustomPrincipal } from '../../utils/principal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface SessionSummary {
  id: string;
  status: { Active?: null; Completed?: null };
  createdAt: bigint;
  roundCount: bigint;
  currentRound?: bigint;
  totalScore: bigint;
  duration?: bigint;
  playerReward?: bigint;
  eloRatingChange?: bigint;
  initialEloRating?: bigint;
  finalEloRating?: bigint;
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { principal, isAdmin, identity, isDevMode } = useAuth();
  const { tokenBalance: storeBalance, setTokenBalance: setStoreBalance } = useGameStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);
  const [isServiceInitialized, setIsServiceInitialized] = React.useState(false);
  const [playerStats, setPlayerStats] = React.useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = React.useState(false);
  const [recentSessions, setRecentSessions] = React.useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
  const [remainingPlays, setRemainingPlays] = React.useState<{ remainingPlays: number; playLimit: number } | null>(null);
  const [isLoadingPlays, setIsLoadingPlays] = React.useState(false);
  const [proStatus, setProStatus] = React.useState<{ isPro: boolean; expiryTime?: bigint; cost: bigint } | null>(null);
  
  // Convert bigint balance to display string
  const displayBalance = React.useMemo(() => {
    const balance = Number(storeBalance) / 100;
    return balance.toFixed(2);
  }, [storeBalance]);

  const fetchTokenBalance = React.useCallback(async () => {
    if (!principal || !gameService.isInitialized) return;
    
    setIsLoadingBalance(true);
    try {
      // Always fetch from backend
      const balance = await gameService.getTokenBalance(CustomPrincipal.fromText(principal.toString()));
      setStoreBalance(balance);
      console.log('🏠 Fetched token balance from backend:', Number(balance));
    } catch (error) {
      console.error('Failed to fetch token balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [principal, setStoreBalance]);

  const fetchPlayerStats = React.useCallback(async () => {
    if (!principal || !gameService.isInitialized) {
      console.log('🏠 fetchPlayerStats skipped - principal:', !!principal, 'gameService.isInitialized:', gameService.isInitialized);
      return;
    }
    
    setIsLoadingStats(true);
    try {
      console.log('🏠 HomeScreen identity:', identity);
      console.log('🏠 HomeScreen principal:', principal?.toString());
      console.log('🏠 HomeScreen identity principal:', identity?.getPrincipal()?.toString());
      console.log('🏠 HomeScreen identity type:', identity?.constructor?.name);
      
      const stats = await gameService.getPlayerStats(principal ? CustomPrincipal.fromText(principal.toString()) : undefined);
      console.log('🏠 Player stats:', stats);
      console.log('🏠 Player stats rank:', stats?.rank);
      console.log('🏠 Player stats rank[0]:', stats?.rank);
      console.log('🏠 Player stats eloRating:', (stats as any)?.eloRating);
      console.log('🏠 Player stats eloRating type:', typeof (stats as any)?.eloRating);
      console.log('🏠 Player stats totalGamesPlayed:', stats?.totalGamesPlayed);
      console.log('🏠 Player stats averageScore:', stats?.averageScore);
      console.log('🏠 Player stats averageScore30Days:', stats?.averageScore30Days);
      setPlayerStats(stats);
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [principal, identity]);

  const fetchRecentSessions = React.useCallback(async () => {
    if (!principal || !gameService.isInitialized) return;
    
    setIsLoadingSessions(true);
    try {
      const result = await gameService.getRecentSessionsWithScores(CustomPrincipal.fromText(principal.toString()), 5);
      if (result.ok) {
        // Sessions are already sorted by creation time (most recent first)
        setRecentSessions(result.ok);
        console.log('🏠 Recent sessions with scores:', result.ok);
      }
    } catch (error) {
      console.error('Failed to fetch recent sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [principal]);

  const fetchRemainingPlays = React.useCallback(async () => {
    if (!principal || !gameService.isInitialized) return;
    
    setIsLoadingPlays(true);
    try {
      const result = await gameService.getRemainingPlays(CustomPrincipal.fromText(principal.toString()));
      console.log('🏠 Remaining plays:', result);
      setRemainingPlays(result);
    } catch (error) {
      console.error('Failed to fetch remaining plays:', error);
    } finally {
      setIsLoadingPlays(false);
    }
  }, [principal]);

  const fetchProStatus = React.useCallback(async () => {
    if (!principal || !gameService.isInitialized) return;
    
    try {
      const status = await gameService.getProMembershipStatus(CustomPrincipal.fromText(principal.toString()));
      console.log('🏠 Pro status:', status);
      setProStatus(status);
    } catch (error) {
      console.error('Failed to fetch Pro status:', error);
    }
  }, [principal]);

  // Initialize game service with identity
  React.useEffect(() => {
    const initService = async () => {
      if (identity && !gameService.isInitialized) {
        try {
          console.log('🏠 HomeScreen: Initializing game service...');
          await gameService.init(identity);
          console.log('🏠 HomeScreen: Game service initialized');
          setIsServiceInitialized(true);
        } catch (error) {
          console.error('Failed to initialize game service:', error);
          setIsServiceInitialized(false);
        }
      } else if (identity && gameService.isInitialized) {
        // Service already initialized
        console.log('🏠 HomeScreen: Game service already initialized');
        setIsServiceInitialized(true);
      }
    };
    initService();
  }, [identity]);

  React.useEffect(() => {
    if (isServiceInitialized && gameService.isInitialized) {
      console.log('🏠 HomeScreen: Fetching data...');
      fetchTokenBalance();
      fetchPlayerStats();
      fetchRecentSessions();
      fetchRemainingPlays();
      fetchProStatus();
      
      // Dev mode: disabled auto-minting per user request
    }
  }, [fetchTokenBalance, fetchPlayerStats, fetchRecentSessions, fetchRemainingPlays, fetchProStatus, isServiceInitialized, identity, principal]);

  // Fetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isServiceInitialized && gameService.isInitialized && principal) {
        fetchTokenBalance();
        fetchPlayerStats();
        fetchRecentSessions();
        fetchRemainingPlays();
      }
    }, [isServiceInitialized, principal, fetchTokenBalance, fetchPlayerStats, fetchRecentSessions, fetchRemainingPlays])
  );

  const onRefresh = React.useCallback(async () => {
    if (gameService.isInitialized) {
      setRefreshing(true);
      await Promise.all([
        fetchTokenBalance(),
        fetchPlayerStats(),
        fetchRemainingPlays()
      ]);
      setTimeout(() => {
        setRefreshing(false);
      }, 2000);
    }
  }, [fetchTokenBalance, fetchPlayerStats, fetchRemainingPlays]);

  const copyPrincipalToClipboard = async () => {
    if (principal) {
      try {
        await Clipboard.setStringAsync(principal.toString());
        Alert.alert(
          'Copied!',
          'Principal ID has been copied to clipboard',
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        Alert.alert(
          'Error',
          'Failed to copy principal ID',
          [{ text: 'OK' }]
        );
      }
    }
  };

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
    <>
      <StatusBar hidden={true} />
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.container}
      >
      <View style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <TouchableOpacity 
                style={styles.principalContainer}
                onPress={copyPrincipalToClipboard}
                activeOpacity={0.7}
              >
                <View style={styles.principalTextContainer}>
                  <Text style={styles.principalText}>
                    {principal ? principal.toString().slice(0, 12) : 'Explorer'}
                  </Text>
                  {proStatus?.isPro && (
                    <MaterialCommunityIcons name="crown" size={16} color="#f59e0b" style={styles.proCrownIcon} />
                  )}
                </View>
                {principal && (
                  <Ionicons name="copy-outline" size={16} color="#64748b" style={styles.copyIcon} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={24} color="#64748b" />
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
                  <Text style={styles.statsValue}>
                    {isLoadingBalance ? '...' : `${displayBalance} SPOT`}
                  </Text>
                </View>
                <View style={[styles.statsBadge, remainingPlays?.playLimit === 5 && styles.proBadge]}>
                  <Text style={[styles.statsBadgeText, remainingPlays?.playLimit === 5 && styles.proBadgeText]}>
                    {isLoadingPlays ? "..." : (remainingPlays ? `${remainingPlays.remainingPlays}/${remainingPlays.playLimit} plays${remainingPlays.playLimit === 5 ? ' (Pro)' : ''}` : '3/3 plays')}
                  </Text>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <StatItem 
                  icon="game-controller-outline" 
                  value={isLoadingStats ? "..." : (playerStats ? Number(playerStats.totalGamesPlayed).toString() : "0")} 
                  label="Games" 
                />
                <StatItem 
                  icon="camera-outline" 
                  value={isLoadingStats ? "..." : (playerStats ? Number(playerStats.totalPhotosUploaded).toString() : "0")} 
                  label="Photos" 
                />
                <StatItem 
                  icon="trophy" 
                  value={isLoadingStats ? "..." : (playerStats && playerStats.rank ? `#${playerStats.rank}` : "Unranked")} 
                  label="Rank" 
                />
                <StatItem 
                  icon="medal" 
                  value={isLoadingStats ? "..." : (playerStats && playerStats.eloRating !== undefined ? `${Number(playerStats.eloRating)}` : "1500")} 
                  label="Rating" 
                />
                <StatItem 
                  icon="trending-up-outline" 
                  value={isLoadingStats ? "..." : (playerStats ? Number(playerStats.averageScore30Days || playerStats.averageScore || 0).toString() : "0")} 
                  label="Avg Score" 
                />
              </View>
              
              {/* Anti-cheat warning if flagged - disabled for now */}
              {/* {playerStats?.suspiciousActivityFlags?.[0] && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning" size={16} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    {playerStats.suspiciousActivityFlags[0]}
                  </Text>
                </View>
              )} */}
            </LinearGradient>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={[styles.menuCard, (item.screen === 'Game' && remainingPlays?.remainingPlays === 0) && styles.disabledCard]}
                onPress={() => {
                  if (item.screen === 'Game' && remainingPlays?.remainingPlays === 0) {
                    return; // Don't navigate if no plays remaining
                  }
                  navigation.navigate(item.screen);
                }}
                activeOpacity={0.8}
                disabled={item.screen === 'Game' && remainingPlays?.remainingPlays === 0}
              >
                <LinearGradient
                  colors={(item.screen === 'Game' && remainingPlays?.remainingPlays === 0) ? ['#4b5563', '#374151'] : item.gradient as any}
                  style={styles.menuGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={[styles.menuIconContainer, (item.screen === 'Game' && remainingPlays?.remainingPlays === 0) && styles.disabledIcon]}>
                    {item.icon === 'trophy' ? (
                      <FontAwesome5 name={item.icon} size={28} color="#ffffff" />
                    ) : item.icon === 'person' ? (
                      <MaterialCommunityIcons name="account-circle" size={28} color="#ffffff" />
                    ) : (
                      <Ionicons name={item.icon as any} size={28} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={[styles.menuTitle, (item.screen === 'Game' && remainingPlays?.remainingPlays === 0) && styles.disabledText]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.menuDescription, (item.screen === 'Game' && remainingPlays?.remainingPlays === 0) && styles.disabledText]}>
                      {(item.screen === 'Game' && remainingPlays?.remainingPlays === 0) ? 'No plays remaining today' : item.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={(item.screen === 'Game' && remainingPlays?.remainingPlays === 0) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)"} />
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {isLoadingSessions ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Loading sessions...</Text>
              </View>
            ) : recentSessions.length > 0 ? (
              <View>
                {recentSessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.sessionCard}
                    onPress={() => {
                      console.log('🏠 Navigating to SessionDetails with:', { sessionId: session.id, session });
                      navigation.navigate('SessionDetails', { sessionId: session.id });
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionDate}>
                          {new Date(Number(session.createdAt) / 1000000).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                        <Text style={styles.sessionStatus}>
                          {session.status?.Completed !== undefined ? 'Completed' : 'In Progress'}
                        </Text>
                      </View>
                      <View style={styles.sessionStats}>
                        <Text style={styles.sessionRounds}>
                          {session.status?.Completed !== undefined 
                            ? `${session.roundCount}/${session.roundCount} rounds`
                            : `${session.currentRound || 0}/${session.roundCount} rounds`
                          }
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionFooter}>
                      <View style={styles.sessionScoreContainer}>
                        <Ionicons name="star" size={16} color="#f59e0b" />
                        <Text style={styles.sessionScore}>
                          Score: {session.totalScore ? Number(session.totalScore).toLocaleString() : 'N/A'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#64748b" />
                    </View>
                    {/* Rewards and Rating Changes */}
                    {(session.playerReward || session.eloRatingChange) && (
                      <View style={styles.sessionRewardsRow}>
                        {session.playerReward && (
                          <View style={styles.sessionRewardItem}>
                            <Ionicons name="cash-outline" size={14} color="#f59e0b" />
                            <Text style={styles.sessionRewardText}>
                              +{(Number(session.playerReward) / 100).toFixed(2)} SPOT
                            </Text>
                          </View>
                        )}
                        {session.eloRatingChange && (
                          <View style={styles.sessionRewardItem}>
                            <FontAwesome5 name="medal" size={14} color={Number(session.eloRatingChange) >= 0 ? "#10b981" : "#ef4444"} />
                            <Text style={[
                              styles.sessionRewardText,
                              { color: Number(session.eloRatingChange) >= 0 ? "#10b981" : "#ef4444" }
                            ]}>
                              {Number(session.eloRatingChange) >= 0 ? '+' : ''}{Number(session.eloRatingChange)} ELO
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={48} color="#475569" />
                <Text style={styles.emptyText}>No recent activity</Text>
                <Text style={styles.emptySubtext}>
                  Start playing to see your game history
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      </LinearGradient>
    </>
  );
}

const StatItem = ({ icon, value, subValue, label }: any) => (
  <View style={styles.statItem}>
    <View style={styles.statIconContainer}>
      {icon === 'medal' ? (
        <FontAwesome5 name={icon} size={18} color="#f59e0b" />
      ) : icon === 'trophy' ? (
        <FontAwesome5 name={icon} size={18} color="#fbbf24" />
      ) : icon === 'trending-up-outline' ? (
        <Ionicons name={icon} size={20} color="#10b981" />
      ) : (
        <Ionicons name={icon} size={20} color={icon.includes('game') ? '#3b82f6' : '#8b5cf6'} />
      )}
    </View>
    <View style={styles.statValueContainer}>
      <Text style={styles.statItemValue}>{value}</Text>
      {subValue && <Text style={styles.statItemSubValue}>{subValue}</Text>}
    </View>
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
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerInfo: {
    flex: 1,
    marginRight: 16,
  },
  welcomeText: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  principalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
    alignSelf: 'flex-start',
  },
  principalText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyIcon: {
    marginLeft: 8,
    opacity: 0.7,
  },
  notificationButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.3)',
  },
  statsCard: {
    paddingHorizontal: 24,
    marginBottom: 28,
    marginTop: 8,
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
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    height: 32,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBadgeText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
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
  statValueContainer: {
    alignItems: 'center',
  },
  statItemValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statItemSubValue: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
  sessionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionStatus: {
    color: '#94a3b8',
    fontSize: 14,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionRounds: {
    color: '#64748b',
    fontSize: 14,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionScore: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  sessionRewardsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.3)',
  },
  sessionRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  sessionRewardText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    color: '#94a3b8',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  disabledCard: {
    opacity: 0.6,
  },
  disabledIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  proBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  proBadgeText: {
    color: '#f59e0b',
  },
  principalTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proCrownIcon: {
    marginLeft: 6,
  },
});