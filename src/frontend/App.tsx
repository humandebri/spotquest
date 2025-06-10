import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import './src/utils/polyfills';
// import './src/global.css';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { IIAuthProvider } from './src/contexts/IIAuthContext';
import { useIIIntegrationContext } from 'expo-ii-integration';
import AppNavigator from './src/navigation/AppNavigator';

// App content component - must be inside IIIntegrationProvider
function AppContent() {
  const { isAuthReady, isAuthenticated } = useIIIntegrationContext();

  // Deep linking configuration
  const linking = {
    prefixes: [
      Linking.createURL('/'),
      'guessthespot://',
      'https://guess-the-spot.app',
      'https://auth.expo.io',
    ],
    config: {
      screens: {
        auth: 'auth',
        Home: '',
        Game: 'game',
        Profile: 'profile',
        Leaderboard: 'leaderboard',
      },
    },
  };

  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={{ color: '#3282b8', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}

// Wrapper component to handle the IIAuthProvider
function AppWithAuth() {
  return (
    <IIAuthProvider>
      <AppContent />
    </IIAuthProvider>
  );
}

// Main App component
export default function App() {
  return (
    <SafeAreaProvider>
      <AppWithAuth />
    </SafeAreaProvider>
  );
}