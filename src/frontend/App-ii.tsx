import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import './src/utils/polyfills';
// import './src/global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import { IIAuthProvider } from './src/contexts/IIAuthContext';
import { useIIAuthStore } from './src/store/iiAuthStore';
import AppNavigatorII from './src/navigation/AppNavigatorII';

// App content component that uses II auth
function AppContent() {
  const { isLoading } = useIIAuthStore();
  const [isReady, setIsReady] = React.useState(true);

  if (!isReady || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={{ color: '#3282b8', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigatorII />
    </NavigationContainer>
  );
}

// Main App component with II Auth Provider
export default function App() {
  return (
    <SafeAreaProvider>
      <IIAuthProvider>
        <AppContent />
      </IIAuthProvider>
    </SafeAreaProvider>
  );
}