import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';

// スクリーンのインポート
import HomeScreen from '../screens/HomeScreen';
import GameScreen from '../screens/GameScreen';
import GamePlayScreen from '../screens/GamePlayScreen';
import GameResultScreen from '../screens/GameResultScreen';
import CameraScreen from '../screens/CameraScreen';
import PhotoUploadScreen from '../screens/PhotoUploadScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import ScheduledPhotosScreen from '../screens/ScheduledPhotosScreen';

export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  GamePlay: {
    gameMode?: string;
    difficulty?: 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
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
    azimuth: number;
    timestamp: number;
  };
  Leaderboard: undefined;
  Profile: undefined;
  Login: undefined;
  ScheduledPhotos: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

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
            component={GameScreen}
            options={{ title: 'Play Game' }}
          />
          <Stack.Screen
            name="GamePlay"
            component={GamePlayScreen}
            options={{ title: 'Guess the Location' }}
          />
          <Stack.Screen
            name="GameResult"
            component={GameResultScreen}
            options={{ title: 'Game Result' }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ title: 'Take Photo' }}
          />
          <Stack.Screen
            name="PhotoUpload"
            component={PhotoUploadScreen}
            options={{ title: 'Upload Photo' }}
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
            name="ScheduledPhotos"
            component={ScheduledPhotosScreen}
            options={{ title: 'Scheduled Posts' }}
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