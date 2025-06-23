import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useGameStore } from '../../store/gameStore';
import { gameService } from '../../services/game';
import { useAuth } from '../../hooks/useAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SessionSummary'>;

export default function SessionSummaryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { roundResults, sessionId, tokenBalance, resetGame, setTokenBalance } = useGameStore();
  const { principal, identity } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [sessionFinalized, setSessionFinalized] = useState(false);
  const [actualReward, setActualReward] = useState<number>(0);
  const [isMinting, setIsMinting] = useState(false);
  const [mintComplete, setMintComplete] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;

  // Calculate total score (cap at 5 rounds to prevent issues)
  const validRounds = roundResults.slice(0, 5); // Only use first 5 rounds
  const totalScore = validRounds.reduce((sum, round) => sum + round.score, 0);
  const maxPossibleScore = Math.min(validRounds.length, 5) * 5000; // Max 5 rounds * 5000 points per round
  
  // Calculate reward based on simple formula: 1 SPOT per round (max)
  // Each round can earn up to 1 SPOT based on score (0-5000)
  // Total max reward = rounds * 1 SPOT
  const calculateReward = () => {
    let totalReward = 0;
    validRounds.forEach(round => {
      // Each round: (score / 5000) * 1.0 SPOT
      const roundReward = (round.score / 5000) * 1.0;
      totalReward += roundReward;
    });
    return totalReward;
  };
  
  const estimatedReward = calculateReward();

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: 300,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Score counter animation
    Animated.timing(scoreAnim, {
      toValue: totalScore,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, []);

  // Map zoom animation - simplified
  useEffect(() => {
    if (mapReady && mapRef.current && validRounds.length > 0) {
      // Simple timer to fit coordinates without animation
      setTimeout(() => {
        const allCoordinates = validRounds.flatMap(round => [
          round.guess,
          round.actualLocation,
        ]);
        
        mapRef.current?.fitToCoordinates(allCoordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: false,
        });
      }, 100);
    }
  }, [mapReady, validRounds]);

  // Finalize session and mint tokens
  useEffect(() => {
    const finalizeSession = async () => {
      // 防止重複実行
      if (!sessionId || sessionFinalized || isMinting || mintComplete) {
        console.log('🚫 Finalize session skipped:', { sessionId, sessionFinalized, isMinting, mintComplete });
        return;
      }
      
      console.log('💰 Starting session finalization:', { sessionId, roundResults: validRounds.length });
      setIsMinting(true);
      
      try {
        // セッションの終了処理
        console.log('📞 Calling gameService.finalizeSession with sessionId:', sessionId);
        console.log('📞 Principal:', principal?.toString());
        const result = await gameService.finalizeSession(sessionId);
        
        console.log('📋 FinalizeSession result:', result);
        
        if (result.ok) {
          setSessionFinalized(true);
          
          // Debug: Session finalization complete
          console.log('🔍 Session finalization completed successfully');
          
          // バックエンドからの実際の報酬を取得
          const backendReward = Number(result.ok.playerReward) / 100; // Convert to decimal SPOT
          
          // 報酬計算（バックエンドと一致させる）
          const calculatedReward = calculateReward();
          const finalReward = backendReward > 0 ? backendReward : calculatedReward;
          setActualReward(finalReward);
          
          console.log('💎 Reward calculation:', {
            backendRewardRaw: result.ok.playerReward,
            backendReward: backendReward.toFixed(4),
            calculatedReward: calculatedReward.toFixed(4),
            finalReward: finalReward.toFixed(4)
          });
          
          
          // バックエンドからトークンバランスを取得（バックエンドで既にmint済み）
          if (principal) {
            console.log('💳 Fetching token balance for principal:', principal.toString());
            const oldBalance = tokenBalance;
            const newBalance = await gameService.getTokenBalance(principal);
            setTokenBalance(newBalance);
            setMintComplete(true);
            
            console.log('✅ Session reward minting completed:', {
              rounds: validRounds.length,
              totalScore: totalScore,
              calculatedReward: calculatedReward.toFixed(2),
              backendReward: backendReward.toFixed(2),
              finalReward: finalReward.toFixed(2),
              oldBalance: oldBalance.toString(),
              newBalance: newBalance.toString(),
              balanceIncrease: (Number(newBalance) - Number(oldBalance)).toString()
            });
          }
        } else {
          console.error('❌ FinalizeSession failed:', result.err);
          setMintComplete(true);
        }
      } catch (error) {
        console.error('💥 Error finalizing session:', error);
        // エラーが発生してもmintCompleteをtrueにして再実行を防ぐ
        setMintComplete(true);
      } finally {
        setIsMinting(false);
      }
    };
    
    finalizeSession();
  }, [sessionId]); // 依存配列を最小限にして無限ループを防ぐ

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored ${totalScore} points in 5 rounds of Guess the Spot! 🌍\nCan you beat my score?`,
        title: 'Guess the Spot Session Score',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Game' },
      ],
    });
  };

  const handleBackToMenu = () => {
    resetGame();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  // Different colors for each round
  const roundColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

  // Calculate initial region for map
  const initialRegion = useMemo(() => {
    if (validRounds.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 1,
        longitudeDelta: 1,
      };
    }

    const allLats = validRounds.flatMap(r => [r.guess.latitude, r.actualLocation.latitude]);
    const allLons = validRounds.flatMap(r => [r.guess.longitude, r.actualLocation.longitude]);
    
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLon = Math.min(...allLons);
    const maxLon = Math.max(...allLons);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const deltaLat = Math.max((maxLat - minLat) * 1.5, 0.1);
    const deltaLon = Math.max((maxLon - minLon) * 1.5, 0.1);
    
    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: deltaLat,
      longitudeDelta: deltaLon,
    };
  }, [validRounds]);

  return (
    <View style={styles.container}>
      {/* Gradient Background */}
      <LinearGradient
        colors={['#1a0033', '#220044', '#1a0033']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Map Section - Full Width */}
      <View style={styles.mapContainer}>
        {validRounds.length > 0 && (
          <MapView
            ref={mapRef}
            style={styles.fullMap}
            provider={PROVIDER_GOOGLE}
            initialRegion={initialRegion}
            onMapReady={() => setMapReady(true)}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsScale={false}
            showsBuildings={false}
            showsTraffic={false}
            showsIndoors={false}
            showsIndoorLevelPicker={false}
            showsPointsOfInterest={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            cacheEnabled={true}
            loadingEnabled={false}
          >
            {validRounds.map((round, index) => (
              <React.Fragment key={index}>
                {/* Your guess marker */}
                <Marker
                  coordinate={{
                    latitude: Number(round.guess.latitude),
                    longitude: Number(round.guess.longitude),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.roundMarker, { backgroundColor: roundColors[index] }]}>
                    <Text style={styles.markerText}>{index + 1}</Text>
                  </View>
                </Marker>
                
                {/* Actual location marker */}
                <Marker
                  coordinate={{
                    latitude: Number(round.actualLocation.latitude),
                    longitude: Number(round.actualLocation.longitude),
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.actualMarker}>
                    <Ionicons name="location" size={24} color="#000" />
                  </View>
                </Marker>
                
                {/* Line connecting them */}
                <Polyline
                  coordinates={[
                    {
                      latitude: Number(round.guess.latitude),
                      longitude: Number(round.guess.longitude),
                    },
                    {
                      latitude: Number(round.actualLocation.latitude),
                      longitude: Number(round.actualLocation.longitude),
                    },
                  ]}
                  strokeColor={roundColors[index]}
                  strokeWidth={2}
                />
              </React.Fragment>
            ))}
          </MapView>
        )}
      </View>

      {/* Bottom Section with Results */}
      <LinearGradient
        colors={['#1a0033', '#220044', '#2d1b69']}
        style={styles.resultsSection}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.resultsContent}>
            <View style={styles.header}>
              <Ionicons name="trophy" size={40} color="#FFD700" />
              <Text style={styles.sessionComplete}>SESSION COMPLETE</Text>
            </View>

            <Animated.Text style={[styles.totalScoreText, { opacity: fadeAnim }]}>
              {totalScore.toLocaleString()} / {maxPossibleScore.toLocaleString()}
            </Animated.Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${(totalScore / maxPossibleScore) * 100}%` 
                    }
                  ]} 
                />
              </View>
              <Text style={styles.percentageText}>
                {((totalScore / maxPossibleScore) * 100).toFixed(1)}%
              </Text>
            </View>

            {/* Token Rewards */}
            <View style={styles.rewardContainer}>
              <Text style={styles.rewardText}>
                Total earned: +{actualReward > 0 ? actualReward.toFixed(2) : estimatedReward.toFixed(2)} SPOT
              </Text>
            </View>

            {/* Round Breakdown */}
            <View style={styles.roundsBreakdown}>
              <Text style={styles.breakdownTitle}>Round Breakdown</Text>
              {validRounds.map((round, index) => (
                <View key={index} style={styles.roundItem}>
                  <View style={[styles.roundDot, { backgroundColor: roundColors[index] }]} />
                  <Text style={styles.roundLabel}>Round {index + 1}</Text>
                  <Text style={styles.roundScore}>{round.score} pts</Text>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.shareButtonText}>SHARE RESULTS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playAgainButton}
                onPress={handlePlayAgain}
                activeOpacity={0.8}
              >
                <Text style={styles.playAgainButtonText}>RETURN TO HOME</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0014',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },
  fullMap: {
    flex: 1,
  },
  roundMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actualMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  resultsSection: {
    height: SCREEN_HEIGHT * 0.50, // 50% of screen height
    paddingTop: 20,
  },
  resultsContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sessionComplete: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    letterSpacing: 1,
  },
  totalScoreText: {
    color: '#FFD700',
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 6,
  },
  percentageText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  rewardContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
    alignItems: 'center',
    marginBottom: 25,
  },
  rewardText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  roundsBreakdown: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 25,
  },
  breakdownTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  roundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  roundDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  roundLabel: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  roundScore: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  shareButton: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  shareButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  playAgainButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAgainButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});