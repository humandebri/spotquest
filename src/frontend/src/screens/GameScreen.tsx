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

interface GameRound {
  id: number;
  photoUrl: string;
  actualLat: number;
  actualLon: number;
}

interface GuessResult {
  distance: number;
  score: number;
  reward: number;
}

export default function GameScreen() {
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [result, setResult] = useState<GuessResult | null>(null);

  useEffect(() => {
    loadNewRound();
  }, []);

  const loadNewRound = async () => {
    setIsLoading(true);
    try {
      // TODO: ICPから新しいラウンドを取得
      // デモ用のモックデータ
      setTimeout(() => {
        setCurrentRound({
          id: 1,
          photoUrl: 'https://picsum.photos/400/300',
          actualLat: 35.6812,
          actualLon: 139.7671,
        });
        setIsLoading(false);
        setHasGuessed(false);
        setSelectedLocation(null);
        setResult(null);
      }, 1000);
    } catch (error) {
      console.error('Failed to load round:', error);
      Alert.alert('エラー', 'ゲームの読み込みに失敗しました');
      setIsLoading(false);
    }
  };

  const handleMapPress = (event: any) => {
    if (hasGuessed) return;
    
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
  };

  const submitGuess = async () => {
    if (!selectedLocation || !currentRound) return;

    setIsLoading(true);
    try {
      // TODO: ICPに推測を送信
      // デモ用の計算
      const distance = calculateDistance(
        selectedLocation.latitude,
        selectedLocation.longitude,
        currentRound.actualLat,
        currentRound.actualLon
      );

      const score = Math.max(0, 100 - Math.floor(distance / 10));
      const reward = score * 0.01; // SPOT tokens

      setResult({ distance, score, reward });
      setHasGuessed(true);
    } catch (error) {
      console.error('Failed to submit guess:', error);
      Alert.alert('エラー', '推測の送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // 地球の半径（km）
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (deg: number): number => {
    return deg * (Math.PI / 180);
  };

  if (isLoading && !currentRound) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.instruction}>
            Where was this photo taken?
          </Text>
          {currentRound && (
            <Image
              source={{ uri: currentRound.photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: 35.6812,
              longitude: 139.7671,
              latitudeDelta: 10,
              longitudeDelta: 10,
            }}
            onPress={handleMapPress}
          >
            {selectedLocation && !hasGuessed && (
              <Marker
                coordinate={selectedLocation}
                title="Your Guess"
                pinColor="#3282b8"
              />
            )}
            
            {hasGuessed && currentRound && (
              <>
                <Marker
                  coordinate={selectedLocation!}
                  title="Your Guess"
                  pinColor="#3282b8"
                />
                <Marker
                  coordinate={{
                    latitude: currentRound.actualLat,
                    longitude: currentRound.actualLon,
                  }}
                  title="Actual Location"
                  pinColor="#4ade80"
                />
              </>
            )}
          </MapView>
        </View>

        {/* Action Section */}
        <View style={styles.actionSection}>
          {!hasGuessed ? (
            <>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !selectedLocation && styles.submitButtonDisabled,
                ]}
                onPress={submitGuess}
                disabled={!selectedLocation || isLoading}
              >
                <Text style={styles.submitButtonText}>
                  {selectedLocation ? 'Submit Guess' : 'Tap the map to guess'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {result && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultTitle}>Result</Text>
                  <Text style={styles.resultText}>
                    Distance: {result.distance.toFixed(2)} km
                  </Text>
                  <Text style={styles.resultText}>
                    Score: {result.score} points
                  </Text>
                  <Text style={styles.resultText}>
                    Reward: {result.reward.toFixed(2)} SPOT
                  </Text>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.nextButton}
                onPress={loadNewRound}
              >
                <Text style={styles.nextButtonText}>Next Round</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  photo: {
    width: '100%',
    height: 250,
    borderRadius: 12,
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