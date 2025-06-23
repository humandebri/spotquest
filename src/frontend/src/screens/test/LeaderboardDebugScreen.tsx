import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';

export default function LeaderboardDebugScreen() {
  const { identity, principal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  const runDebugTests = async () => {
    setLoading(true);
    const info: any = {};

    try {
      // Initialize service
      if (identity) {
        await gameService.init(identity);
        info.serviceInitialized = true;
        info.principal = principal?.toString();
      }

      // Test 1: Get leaderboard with different limits
      console.log('🔍 Testing leaderboard with limit 1...');
      const leaderboard1 = await gameService.getLeaderboardWithStats(1);
      info.leaderboard1 = {
        count: leaderboard1.length,
        data: leaderboard1.map(e => ({
          principal: e.principal.toString().slice(0, 10) + '...',
          score: Number(e.score),
          games: Number(e.gamesPlayed),
        })),
      };

      console.log('🔍 Testing leaderboard with limit 10...');
      const leaderboard10 = await gameService.getLeaderboardWithStats(10);
      info.leaderboard10 = {
        count: leaderboard10.length,
        data: leaderboard10.map(e => ({
          principal: e.principal.toString().slice(0, 10) + '...',
          score: Number(e.score),
          games: Number(e.gamesPlayed),
        })),
      };

      console.log('🔍 Testing leaderboard with limit 100...');
      const leaderboard100 = await gameService.getLeaderboardWithStats(100);
      info.leaderboard100 = {
        count: leaderboard100.length,
        uniquePrincipals: new Set(leaderboard100.map(e => e.principal.toString())).size,
      };

      // Test 2: Get top uploaders
      console.log('🔍 Testing top uploaders...');
      const uploaders = await gameService.getTopUploaders(50);
      info.uploaders = {
        count: uploaders.length,
        data: uploaders.slice(0, 5).map(e => ({
          principal: e.principal.toString().slice(0, 10) + '...',
          photos: Number(e.totalPhotos),
          timesUsed: Number(e.totalTimesUsed),
        })),
      };

      // Test 3: Get player stats for current user
      if (principal) {
        console.log('🔍 Getting current user stats...');
        const myStats = await gameService.getPlayerStats(principal);
        info.myStats = {
          gamesPlayed: Number(myStats?.totalGamesPlayed || 0),
          photosUploaded: Number(myStats?.totalPhotosUploaded || 0),
          bestScore: Number(myStats?.bestScore || 0),
          rank: myStats?.rank ? Number(myStats.rank) : 'Unranked',
        };
      }

      // Test 4: Get raw leaderboard without stats
      console.log('🔍 Testing raw leaderboard...');
      const rawLeaderboard = await gameService.getLeaderboard(50);
      info.rawLeaderboard = {
        count: rawLeaderboard.length,
        data: rawLeaderboard.slice(0, 5).map(e => ({
          principal: e.principal.toString().slice(0, 10) + '...',
          score: Number(e.score),
        })),
      };

    } catch (error: any) {
      info.error = error.message || 'Unknown error';
      console.error('Debug test error:', error);
    }

    setDebugInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    runDebugTests();
  }, []);

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Leaderboard Debug Info</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#3b82f6" />
          ) : (
            <View style={styles.content}>
              <Text style={styles.json}>{JSON.stringify(debugInfo, null, 2)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={runDebugTests}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Refresh Debug Info</Text>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: {
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  content: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  json: {
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});