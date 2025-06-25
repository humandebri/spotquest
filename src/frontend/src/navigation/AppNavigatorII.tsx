import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIIAuthStore } from '../store/iiAuthStore';

// スクリーンのインポート
// Home
import HomeScreen from '../screens/home/HomeScreen';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// Game
import GameModeScreen from '../screens/game/GameModeScreen';
import GamePlayScreen from '../screens/game/GamePlayScreen';
import GuessMapScreen from '../screens/game/GuessMapScreen';
import GameResultScreen from '../screens/game/GameResultScreen';

// Photo
import CameraScreen from '../screens/photo/CameraScreen';
import PhotoUploadScreen from '../screens/photo/PhotoUploadScreenV2';

// User
import LeaderboardScreen from '../screens/user/LeaderboardScreen';
import ProfileScreen from '../screens/user/ProfileScreen';

// Admin
import AdminScreen from '../screens/admin/AdminScreen';

export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  GamePlay: {
    gameMode?: string;
    difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
  };
  GuessMap: {
    photoUrl: string;
    difficulty: string;
    timeLeft: number;
    initialGuess?: { latitude: number; longitude: number };
    confidenceRadius?: number;
  };
  GameResult: {
    guess: { latitude: number; longitude: number };
    actualLocation: { latitude: number; longitude: number };
    score: number;
    timeUsed: number;
    azimuthGuess?: number;
    actualAzimuth?: number;
    difficulty?: string;
    photoUrl?: string;
  };
  Camera: undefined;
  PhotoUpload: {
    photoUri: string;
    latitude: number;
    longitude: number;
    azimuth: number | null;
    timestamp: number;
  };
  Leaderboard: undefined;
  Profile: undefined;
  Login: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigatorII() {
  const { isAuthenticated } = useIIAuthStore();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#3282b8',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
      initialRouteName={isAuthenticated ? "Home" : "Login"}
    >
      {isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Guess the Spot' }}
          />
          <Stack.Screen
            name="Game"
            component={GameModeScreen}
            options={{ title: 'Select Game Mode' }}
          />
          <Stack.Screen
            name="GamePlay"
            component={GamePlayScreen}
            options={{ title: 'Guess the Location' }}
          />
          <Stack.Screen
            name="GuessMap"
            component={GuessMapScreen}
            options={{ 
              title: 'Select Location',
              presentation: 'fullScreenModal',
              headerShown: false
            }}
          />
          <Stack.Screen
            name="GameResult"
            component={GameResultScreen}
            options={{ 
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ title: 'Take Photo' }}
          />
          <Stack.Screen
            name="PhotoUpload"
            component={PhotoUploadScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Leaderboard"
            component={LeaderboardScreen}
            options={{ title: 'Leaderboard' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: 'My Profile' }}
          />
          <Stack.Screen
            name="Admin"
            component={AdminScreen}
            options={{ title: 'Admin Dashboard' }}
          />
        </Stack.Group>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}