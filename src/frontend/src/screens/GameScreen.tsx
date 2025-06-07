import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

interface GameRound {
  id: number;
  photoUrl: string;
  actualLat: number;
  actualLon: number;
  azimuth: number; // 写真の方位角
  takenAt: number; // 撮影日時のタイムスタンプ
}

interface GuessResult {
  distance: number;
  score: number;
  reward: number;
}

export default function GameScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Game'>>();

  // ゲーム開始ボタンを押したら実際のゲームプレイに遷移
  const startGamePlay = () => {
    navigation.navigate('GamePlay', {
      gameMode: 'normal',
      difficulty: 'NORMAL',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Game Mode Selection */}
        <View style={styles.gameModeSection}>
          <Text style={styles.sectionTitle}>
            Select Game Mode
          </Text>
          
          <TouchableOpacity 
            style={styles.gameModeCard}
            onPress={startGamePlay}
          >
            <View style={styles.gameModeIcon}>
              <Text style={styles.gameModeEmoji}>🌍</Text>
            </View>
            <View style={styles.gameModeInfo}>
              <Text style={styles.gameModeTitle}>Classic Mode</Text>
              <Text style={styles.gameModeDescription}>
                Guess the location from a single photo
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gameModeCard, styles.comingSoon]}
            disabled
          >
            <View style={styles.gameModeIcon}>
              <Text style={styles.gameModeEmoji}>⚡</Text>
            </View>
            <View style={styles.gameModeInfo}>
              <Text style={styles.gameModeTitle}>Speed Mode</Text>
              <Text style={styles.gameModeDescription}>
                Race against time with multiple photos
              </Text>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.gameModeCard, styles.comingSoon]}
            disabled
          >
            <View style={styles.gameModeIcon}>
              <Text style={styles.gameModeEmoji}>👥</Text>
            </View>
            <View style={styles.gameModeInfo}>
              <Text style={styles.gameModeTitle}>Multiplayer</Text>
              <Text style={styles.gameModeDescription}>
                Compete with other players in real-time
              </Text>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gameModeSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  gameModeCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoon: {
    opacity: 0.5,
  },
  gameModeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f1117',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  gameModeEmoji: {
    fontSize: 30,
  },
  gameModeInfo: {
    flex: 1,
  },
  gameModeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  gameModeDescription: {
    fontSize: 14,
    color: '#94a3b8',
  },
  comingSoonText: {
    fontSize: 12,
    color: '#3282b8',
    marginTop: 5,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1117',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
  },
  photoSection: {
    padding: 20,
  },
  instruction: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  compassContainer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    height: 20,
  },
  compassBar: {
    height: 20,
    position: 'relative',
  },
  compassLabel: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '400',
    transform: [{ translateX: -5 }], // 文字を中央揃え
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  compassCenterMark: {
    position: 'absolute',
    left: '50%',
    top: 8,
    width: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ translateX: -0.5 }],
  },
  monthBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  monthText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  mapSection: {
    height: 300,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  actionSection: {
    padding: 20,
  },
  submitButton: {
    backgroundColor: '#3282b8',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#1a1a2e',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3282b8',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 5,
  },
  nextButton: {
    backgroundColor: '#4ade80',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#0f1117',
    fontSize: 16,
    fontWeight: 'bold',
  },
});