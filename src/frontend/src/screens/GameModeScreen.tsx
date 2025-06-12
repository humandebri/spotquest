import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Ionicons, 
  MaterialCommunityIcons, 
  FontAwesome5,
  MaterialIcons 
} from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';

export default function GameModeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Game'>>();
  const [selectedDifficulty, setSelectedDifficulty] = useState('NORMAL');

  const startGamePlay = (difficulty: string) => {
    navigation.navigate('GamePlay', {
      gameMode: 'normal',
      difficulty: difficulty as any,
    });
  };

  const gameModes = [
    {
      title: 'Classic Mode',
      description: 'Guess the location from a single photo',
      icon: 'earth',
      gradient: ['#3b82f6', '#2563eb'],
      available: true,
      difficulty: 'NORMAL',
    },
    {
      title: 'Speed Mode',
      description: 'Race against time with multiple photos',
      icon: 'speed',
      gradient: ['#f59e0b', '#d97706'],
      available: false,
      difficulty: 'HARD',
    },
    {
      title: 'Multiplayer',
      description: 'Compete with other players in real-time',
      icon: 'people',
      gradient: ['#8b5cf6', '#7c3aed'],
      available: false,
      difficulty: 'EXTREME',
    },
  ];

  const difficultyLevels = [
    {
      name: 'EASY',
      label: 'Easy',
      description: '5 min timer • More hints',
      icon: 'happy-outline',
      color: '#10b981',
      multiplier: '0.8x',
    },
    {
      name: 'NORMAL',
      label: 'Normal',
      description: '3 min timer • Standard hints',
      icon: 'flash',
      color: '#3b82f6',
      multiplier: '1.0x',
    },
    {
      name: 'HARD',
      label: 'Hard',
      description: '2 min timer • Limited hints',
      icon: 'flame',
      color: '#f59e0b',
      multiplier: '1.5x',
    },
    {
      name: 'EXTREME',
      label: 'Extreme',
      description: '1 min timer • No hints',
      icon: 'skull',
      color: '#ef4444',
      multiplier: '2.0x',
    },
  ];

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Challenge</Text>
            <Text style={styles.subtitle}>
              Select a game mode and test your geography skills
            </Text>
          </View>

          {/* Game Modes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Modes</Text>
            {gameModes.map((mode) => (
              <TouchableOpacity
                key={mode.title}
                style={[styles.modeCard, !mode.available && styles.modeCardDisabled]}
                onPress={() => mode.available && startGamePlay(selectedDifficulty)}
                disabled={!mode.available}
                activeOpacity={mode.available ? 0.8 : 1}
              >
                <LinearGradient
                  colors={mode.available ? mode.gradient : ['#475569', '#334155']}
                  style={styles.modeGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.modeIconContainer}>
                    {mode.icon === 'earth' ? (
                      <MaterialCommunityIcons name={mode.icon} size={32} color="#ffffff" />
                    ) : mode.icon === 'speed' ? (
                      <MaterialIcons name={mode.icon} size={32} color="#ffffff" />
                    ) : (
                      <Ionicons name={mode.icon} size={32} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.modeTextContainer}>
                    <View style={styles.modeTitleRow}>
                      <Text style={styles.modeTitle}>{mode.title}</Text>
                      {!mode.available && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>COMING SOON</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modeDescription}>{mode.description}</Text>
                  </View>
                  {mode.available && (
                    <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Difficulty Level</Text>
            <View style={styles.difficultyContainer}>
              {difficultyLevels.map((level) => (
                <TouchableOpacity
                  key={level.name}
                  style={[
                    styles.difficultyItem,
                    selectedDifficulty === level.name && styles.difficultyItemSelected
                  ]}
                  onPress={() => setSelectedDifficulty(level.name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.difficultyIcon, { backgroundColor: `${level.color}20` }]}>
                    {level.icon === 'flame' ? (
                      <FontAwesome5 name="fire" size={18} color={level.color} />
                    ) : level.icon === 'skull' ? (
                      <MaterialCommunityIcons name={level.icon} size={20} color={level.color} />
                    ) : (
                      <Ionicons name={level.icon} size={20} color={level.color} />
                    )}
                  </View>
                  <View style={styles.difficultyTextContainer}>
                    <View style={styles.difficultyLabelRow}>
                      <Text style={styles.difficultyLabel}>{level.label}</Text>
                      <View style={[styles.multiplierBadge, { backgroundColor: `${level.color}20` }]}>
                        <Text style={[styles.multiplierText, { color: level.color }]}>
                          {level.multiplier}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.difficultyDescription}>{level.description}</Text>
                  </View>
                  {selectedDifficulty === level.name && (
                    <Ionicons name="checkmark-circle" size={24} color={level.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => startGamePlay(selectedDifficulty)}
              activeOpacity={0.8}
              style={styles.startButton}
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.startButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="play" size={24} color="#ffffff" />
                <Text style={styles.startButtonText}>Start Classic Mode</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color="#3b82f6" />
              <View style={styles.tipTextContainer}>
                <Text style={styles.tipTitle}>Pro Tip</Text>
                <Text style={styles.tipText}>
                  Look for unique landmarks, vegetation patterns, and architectural styles to narrow down the location.
                </Text>
              </View>
            </View>
          </View>
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
    paddingBottom: 20,
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
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modeCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modeCardDisabled: {
    opacity: 0.5,
  },
  modeGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  comingSoonBadge: {
    marginLeft: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modeDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  difficultyContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  difficultyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  difficultyItemSelected: {
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
  },
  difficultyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  difficultyTextContainer: {
    flex: 1,
  },
  difficultyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  difficultyLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  multiplierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  difficultyDescription: {
    color: '#94a3b8',
    fontSize: 14,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  startButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  startButtonGradient: {
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  tipsContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  tipCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  tipTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  tipTitle: {
    color: '#3b82f6',
    fontWeight: '600',
    marginBottom: 4,
  },
  tipText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});