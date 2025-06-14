import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { DEBUG_CONFIG, debugLog } from '../utils/debugConfig';

// スクリーンのインポート
import HomeScreen from '../screens/HomeScreen';
import GameModeScreen from '../screens/GameModeScreen';
import GamePlayScreen from '../screens/GamePlayScreen';
import GuessMapScreen from '../screens/GuessMapScreen';
import GameResultScreen from '../screens/GameResultScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import CameraScreen from '../screens/CameraScreen';
import PhotoUploadScreen from '../screens/PhotoUploadScreenV2';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import AdminScreen from '../screens/AdminScreen';
// import ScheduledPhotosScreen from '../screens/ScheduledPhotosScreen';

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
  SessionSummary: undefined;
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

export default function AppNavigator() {
  const { isAuthenticated, isLoading, isDevMode } = useAuth();
  
  // Debug navigation state
  debugLog('AUTH_FLOW', '🔍 Navigator state:', { 
    isAuthenticated, 
    isLoading, 
    isDevMode,
    initialRoute: isAuthenticated ? "Home" : "Login"
  });
  
  // Show loading while auth is initializing (but not in dev mode)
  if (isLoading && !isDevMode) {
    return null; // or a loading component
  }

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
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Game"
            component={GameModeScreen}
            options={{ title: 'Select Game Mode' }}
          />
          <Stack.Screen
            name="GamePlay"
            component={GamePlayScreen}
            options={{ headerShown: false }}
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
            name="SessionSummary"
            component={SessionSummaryScreen}
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
          {/* <Stack.Screen
            name="ScheduledPhotos"
            component={ScheduledPhotosScreen}
            options={{ title: 'Scheduled Posts' }}
          /> */}
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