import './src/utils/earlyPatches'; // MUST be first import
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
import * as WebBrowser from 'expo-web-browser';
import { IIAuthProviderWithReset } from './src/contexts/IIAuthProviderWithReset';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { DevAuthProvider } from './src/contexts/DevAuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { enableJSONParseLogging } from './src/utils/jsonSafeParse';
import { patchIIIntegrationFetch } from './src/utils/iiIntegrationPatch';
import { patchStorageForIIIntegration } from './src/utils/storagePatch';
import { debugStorage } from './src/utils/debugStorage';
import { patchExpoIIIntegration } from './src/utils/expoIIIntegrationPatch';
import { patchEd25519KeyIdentity } from './src/utils/ed25519Fix';
import { DEBUG_CONFIG, debugLog } from './src/utils/debugConfig';

// Enable JSON parse debugging and fetch patching in development
if (__DEV__) {
  debugLog('AUTH_FLOW', '🚀 Applying development patches...');
  // Apply debug first
  debugStorage();
  // Apply Ed25519 patch first - before any library might use it
  patchEd25519KeyIdentity();
  // Then patch expo-ii-integration
  patchExpoIIIntegration();
  // Then other patches
  enableJSONParseLogging();
  patchStorageForIIIntegration();
  patchIIIntegrationFetch();
  debugLog('AUTH_FLOW', '🚀 All patches applied');
}

// ★ 必須: Safari/WebBrowserが閉じるように
WebBrowser.maybeCompleteAuthSession();

// App content component - must be inside IIIntegrationProvider
function AppContent() {
  const { isAuthReady, isAuthenticated } = useIIIntegrationContext();
  
  // Monitor deep linking events
  React.useEffect(() => {
    const handleUrl = (url: { url: string }) => {
      debugLog('DEEP_LINKS', '🔗 Deep link received:', url.url);
      
      // Check if this is an auth callback
      if (url.url.includes('auth') || url.url.includes('delegation') || url.url.includes('--/')) {
        debugLog('DEEP_LINKS', '🔗 Auth callback detected!');
        debugLog('DEEP_LINKS', '🔗 Full URL:', url.url);
        
        // Parse the URL to check for delegation data
        try {
          const urlObj = new URL(url.url);
          const params = new URLSearchParams(urlObj.search);
          
          debugLog('DEEP_LINKS', '🔗 URL params:', Object.fromEntries(params));
          
          if (params.has('delegation')) {
            debugLog('DEEP_LINKS', '🔗 Delegation found in URL!');
          }
        } catch (e) {
          debugLog('DEEP_LINKS', '🔗 Could not parse URL:', e);
        }
        
        // Force auth session completion
        WebBrowser.maybeCompleteAuthSession();
        
        // Check auth state after a short delay
        setTimeout(() => {
          debugLog('DEEP_LINKS', '🔗 Checking auth state after redirect...');
          debugLog('DEEP_LINKS', '🔗 Current auth state:', {
            isAuthenticated,
            isAuthReady
          });
        }, 1000);
      }
    };
    
    // Listen for URL changes
    const subscription = Linking.addEventListener('url', handleUrl);
    
    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        debugLog('DEEP_LINKS', '🔗 Initial URL:', url);
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isAuthReady]);

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
    <DevAuthProvider>
      <IIAuthProviderWithReset>
        <AppContent />
      </IIAuthProviderWithReset>
    </DevAuthProvider>
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