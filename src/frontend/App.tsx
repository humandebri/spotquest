import './app/utils/earlyPatches'; // MUST be first import
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import './app/utils/polyfills';
// import './app/global.css';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Font from 'expo-font';
import { makeRedirectUri } from 'expo-auth-session';
import { 
  Ionicons, 
  MaterialIcons, 
  FontAwesome, 
  MaterialCommunityIcons, 
  Feather,
  FontAwesome5 
} from '@expo/vector-icons';
import { useIIIntegration, IIIntegrationProvider, useIIIntegrationContext } from 'expo-ii-integration';
import { buildAppConnectionURL } from 'expo-icp-app-connect-helpers';
import { getDeepLinkType } from 'expo-icp-frontend-helpers';
import { DevAuthProvider } from './app/contexts/DevAuthContext';
import AppNavigator from './app/navigation/AppNavigator';
import { GlobalErrorBoundary } from './app/components/GlobalErrorBoundary';
import { enableJSONParseLogging } from './app/utils/jsonSafeParse';
import { patchIIIntegrationFetch } from './app/utils/iiIntegrationPatch';
import { patchStorageForIIIntegration } from './app/utils/storagePatch';
import { debugStorage } from './app/utils/debugStorage';
import { patchExpoIIIntegration } from './app/utils/expoIIIntegrationPatch';
import { patchEd25519KeyIdentity } from './app/utils/ed25519Fix';
import { DEBUG_CONFIG, debugLog } from './app/utils/debugConfig';
import { secureStorage, regularStorage } from './app/storage';
import { cryptoModule } from './app/crypto';

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
  const [fontsLoaded, setFontsLoaded] = React.useState(false);
  
  // Load icon fonts
  React.useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
          ...MaterialIcons.font,
          ...FontAwesome.font,
          ...MaterialCommunityIcons.font,
          ...Feather.font,
          ...FontAwesome5.font,
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Failed to load fonts:', error);
        // Set fonts loaded anyway to prevent app from hanging
        setFontsLoaded(true);
      }
    };
    
    loadFonts();
  }, []);
  
  // Monitor deep linking events
  React.useEffect(() => {
    const handleUrl = (url: { url: string }) => {
      debugLog('DEEP_LINKS', '🔗 Deep link received:', url.url);
      
      // Check if this is an auth callback (spotquest://callback pattern)
      if (url.url.includes('callback') || url.url.includes('auth') || url.url.includes('delegation') || url.url.includes('--/')) {
        debugLog('DEEP_LINKS', '🔗 Auth callback detected!');
        debugLog('DEEP_LINKS', '🔗 Full URL:', url.url);
        
        // Parse the URL to check for token data
        try {
          // Parse URL and check both query params and fragment
          const parsed = Linking.parse(url.url);
          const { queryParams } = parsed;
          const fragment = (parsed as any).fragment;
          debugLog('DEEP_LINKS', '🔗 Parsed URL fragment:', fragment);
          debugLog('DEEP_LINKS', '🔗 Parsed URL query params:', queryParams);
          
          // Check fragment for access_token (II typically uses fragment)
          if (fragment) {
            const fragmentParams = new URLSearchParams(fragment);
            const accessToken = fragmentParams.get('access_token');
            const delegation = fragmentParams.get('delegation');
            
            if (accessToken) {
              debugLog('DEEP_LINKS', '🔗 Access token found in fragment!');
              // Token handling will be done by expo-ii-integration
            }
            if (delegation) {
              debugLog('DEEP_LINKS', '🔗 Delegation found in fragment!');
            }
          }
          
          // Also check query params
          if (queryParams) {
            debugLog('DEEP_LINKS', '🔗 Query params:', queryParams);
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
        // Expo's addEventListener returns an object with remove method
        if (subscription && typeof subscription === 'object') {
          const sub = subscription as { remove?: () => void };
          if (typeof sub.remove === 'function') {
            sub.remove();
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
      'https://spotquest.app',
      'https://auth.expo.io/@hude/spotquest',
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

  if (!isAuthReady || !fontsLoaded) {
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
  // Get environment variables
  const dfxNetwork = process.env.EXPO_PUBLIC_DFX_NETWORK || 'ic';
  const iiIntegrationCanisterId = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID || '';
  const frontendCanisterId = process.env.EXPO_PUBLIC_FRONTEND_CANISTER_ID || '';
  
  // Build deep link for II integration
  const deepLink = Linking.createURL('/');
  console.log('🔗 Deep link for AuthSession:', deepLink);
  console.log('🔗 Should match the redirect from callback (with --/auth for native)');
  
  // Build II integration URL using the correct helper
  let iiIntegrationUrl = buildAppConnectionURL({
    dfxNetwork,
    localIPAddress: 'localhost', // Not used when dfxNetwork is 'ic'
    targetCanisterId: iiIntegrationCanisterId,
    pathname: '/newSession',  // Add path to newSession endpoint
  });
  
  // Override URL to use raw domain for mainnet
  if (dfxNetwork === 'ic') {
    const urlStr = iiIntegrationUrl.toString();
    const rawUrl = urlStr.replace('.icp0.io', '.raw.icp0.io');
    iiIntegrationUrl = new URL(rawUrl);
  }
  
  // Helper function to handle custom scheme
  function safeGetDeepLinkType(params: Parameters<typeof getDeepLinkType>[0]): "icp" | "dev-server" | "expo-go" | "legacy" | "modern" {
    try {
      return getDeepLinkType(params);
    } catch (err) {
      // Custom scheme (spotquest://) fallback to legacy
      if (params.deepLink.startsWith('spotquest://')) {
        return 'legacy';
      }
      throw err;
    }
  }
  
  // Determine deep link type based on environment
  const deepLinkType = safeGetDeepLinkType({
    deepLink,
    frontendCanisterId,
    easDeepLinkType: process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE,
  });
  
  debugLog('AUTH_FLOW', '🔗 II Integration URL:', iiIntegrationUrl);
  debugLog('AUTH_FLOW', '🔗 Deep Link Type:', deepLinkType);
  console.log('🔗 II Integration URL (should include /newSession):', iiIntegrationUrl.toString());
  console.log('🔗 Using RAW domain:', iiIntegrationUrl.toString().includes('.raw.icp0.io'));
  
  const iiIntegration = useIIIntegration({
    iiIntegrationUrl,
    deepLinkType,
    secureStorage,
    regularStorage,
    cryptoModule,
  });
  
  const { authError, isAuthReady } = iiIntegration;
  
  React.useEffect(() => {
    if (authError) {
      console.error('Auth error:', authError);
    }
  }, [authError]);
  
  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#3282b8" />
        <Text style={{ color: '#3282b8', marginTop: 10 }}>Initializing...</Text>
      </View>
    );
  }
  
  return (
    <DevAuthProvider>
      <IIIntegrationProvider value={iiIntegration}>
        <AppContent />
      </IIIntegrationProvider>
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