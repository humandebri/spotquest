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
import { GlobalErrorBoundary } from './src/components/GlobalErrorBoundary';
import { enableJSONParseLogging } from './src/utils/jsonSafeParse';
import { patchIIIntegrationFetch } from './src/utils/iiIntegrationPatch';
import { patchStorageForIIIntegration } from './src/utils/storagePatch';
import { debugStorage } from './src/utils/debugStorage';
import { patchExpoIIIntegration } from './src/utils/expoIIIntegrationPatch';
import { patchEd25519KeyIdentity } from './src/utils/ed25519Fix';
import { DEBUG_CONFIG, debugLog } from './src/utils/debugConfig';

// Apply critical patches - needed in both dev and production
debugLog('AUTH_FLOW', '🚀 Applying patches...');

// Critical patches that must run in production
patchEd25519KeyIdentity();
patchExpoIIIntegration();
patchStorageForIIIntegration();
patchIIIntegrationFetch();

// Debug-only patches
if (__DEV__) {
  debugStorage();
  enableJSONParseLogging();
}

debugLog('AUTH_FLOW', '🚀 All patches applied');

// ★ 必須: Safari/WebBrowserが閉じるように
try {
  if (WebBrowser && typeof WebBrowser.maybeCompleteAuthSession === 'function') {
    WebBrowser.maybeCompleteAuthSession();
  }
} catch (error) {
  console.log('WebBrowser.maybeCompleteAuthSession not available:', error);
}

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
      try {
        // より安全なチェック - subscriptionがオブジェクトであることを確認
        if (subscription && typeof subscription === 'object' && 'remove' in subscription) {
          if (typeof subscription.remove === 'function') {
            subscription.remove();
            debugLog('DEEP_LINKS', '✅ Linking event listener removed successfully');
          }
        }
      } catch (error) {
        console.log('⚠️ Error removing Linking event listener:', error);
      }
    };
  }, [isAuthenticated, isAuthReady]);

  // Deep linking configuration
  const linking = {
    prefixes: [
      Linking.createURL('/'),
      'spotquest://',
      'https://spotquest.app',
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
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <AppWithAuth />
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}