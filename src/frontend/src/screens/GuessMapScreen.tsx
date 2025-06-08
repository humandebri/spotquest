import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useGameStore } from '../store/gameStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


export default function GuessMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GuessMap'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GuessMap'>>();
  const { setGuess: setGameGuess, currentPhoto, resetGame } = useGameStore();
  
  const { 
    photoUrl, 
    difficulty, 
    timeLeft, 
    initialGuess,
  } = route.params || {};

  const [guess, setGuess] = useState<{ latitude: number; longitude: number } | null>(initialGuess || null);

  const handleSubmit = () => {
    if (!guess) {
      console.warn('No guess provided');
      return;
    }

    try {
      // Save guess to store
      setGameGuess(guess, 1000); // Fixed confidence radius
      
      // Default location if currentPhoto is undefined (Tokyo)
      const actualLocation = currentPhoto?.actualLocation || { latitude: 35.6762, longitude: 139.6503 };
      
      // Ensure all required parameters are defined
      const resultParams = {
        guess: {
          latitude: guess.latitude || 0,
          longitude: guess.longitude || 0,
        },
        actualLocation: {
          latitude: actualLocation.latitude || 35.6762,
          longitude: actualLocation.longitude || 139.6503,
        },
        score: 85, // TODO: Calculate actual score
        timeUsed: Math.max(0, 180 - (timeLeft || 180)),
        difficulty: difficulty || 'NORMAL',
        photoUrl: photoUrl || 'https://picsum.photos/800/600',
      };

      console.log('Navigating to GameResult with params:', resultParams);
      
      // Reset the guess in the store
      setGameGuess(null, 1000);
      
      // Navigate to GameResult and remove this screen from stack
      navigation.replace('GameResult', resultParams);
    } catch (error) {
      console.error('Error submitting guess:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* 上部のヘッダー */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.photoContainer}>
            <Image 
              source={{ uri: photoUrl }} 
              style={styles.photoThumbnail}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.difficulty}>{difficulty}</Text>
            <View style={styles.timer}>
              <Ionicons name="timer" size={18} color="#fff" />
              <Text style={styles.timerText}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* 地図 */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        initialRegion={{
          latitude: initialGuess?.latitude || 35.6762,
          longitude: initialGuess?.longitude || 139.6503,
          latitudeDelta: initialGuess ? 5 : 50,
          longitudeDelta: initialGuess ? 5 : 50,
        }}
        onPress={(e) => setGuess(e.nativeEvent.coordinate)}
      >
        {guess && (
          <Marker
            coordinate={guess}
            draggable
            onDragEnd={(e) => setGuess(e.nativeEvent.coordinate)}
          >
            <View style={styles.guessMarker}>
              <Ionicons name="location" size={40} color="#FF0000" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* 送信ボタン */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitButton, !guess && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!guess}
        >
          <LinearGradient
            colors={guess ? ['#4CAF50', '#45A049'] : ['#64748b', '#475569']}
            style={styles.submitGradient}
          >
            <Text style={styles.submitText}>
              {guess ? '推測を送信' : '地図をタップして推測'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  header: {
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  photoContainer: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  difficulty: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  guessMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  submitButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 5,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    padding: 15,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});