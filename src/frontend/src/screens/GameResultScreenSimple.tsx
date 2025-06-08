import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';

type GameResultScreenRouteProp = RouteProp<RootStackParamList, 'GameResult'>;
type GameResultScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GameResult'>;

export default function GameResultScreenSimple() {
  const navigation = useNavigation<GameResultScreenNavigationProp>();
  const route = useRoute<GameResultScreenRouteProp>();
  const { resetGame } = useGameStore();
  
  // Extremely safe parameter extraction
  let params = {};
  try {
    params = route?.params || {};
  } catch (error) {
    console.error('Error getting params:', error);
  }
  
  console.log('GameResultSimple params:', params);
  
  const handlePlayAgain = () => {
    // Reset game state before starting new game
    resetGame();
    navigation.navigate('Game');
  };

  const handleBackToMenu = () => {
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Game Result</Text>
        <Text style={styles.score}>Score: {(params as any).score || 0}</Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={handlePlayAgain}
        >
          <Text style={styles.buttonText}>Play Again</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={handleBackToMenu}
        >
          <Text style={styles.buttonText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  score: {
    fontSize: 24,
    color: '#3b82f6',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});