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
import Constants from 'expo-constants';
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
import { debugLog } from './app/utils/debugConfig';
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

// Complete any pending auth sessions on app start
WebBrowser.maybeCompleteAuthSession();

// App content component - must be inside IIIntegrationProvider
function AppContent() {
  const { isAuthReady } = useIIIntegrationContext();
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

  // Monitor deep linking events (handled by expo-ii-integration)
  React.useEffect(() => {
    const handleUrl = (url: { url: string }) => {
      debugLog('DEEP_LINKS', '🔗 Deep link received:', url.url);
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    
    Linking.getInitialURL().then((url) => {
      if (url) debugLog('DEEP_LINKS', '🔗 Initial URL:', url);
    });

    return () => subscription?.remove?.();
  }, []);

  // Deep linking configuration
  const linking = {
    prefixes: [
      Linking.createURL('/'),              // spotquest:///
      'https://spotquest.app',             // Custom domain (optional)
      'https://auth.expo.dev/@hude/spotquest', // Expo Auth proxy (.dev is correct)  
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

  // Determine runtime environment
  const easDeepLinkType = process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE;
  const appOwnership = (Constants as any).appOwnership as ('expo' | 'guest' | 'standalone' | undefined);
  // appOwnership meanings:
  // - 'expo': Expo Go
  // - 'guest': Expo Dev Client
  // - 'standalone': App Store/Production or adhoc standalone
  const isExpoGo = appOwnership === 'expo';
  const isDevClient = appOwnership === 'guest';
  const isStandalone = appOwnership === 'standalone';
  
  // Generate appropriate redirect URI based on environment
  const redirectUri = (() => {
    if (isExpoGo || easDeepLinkType === 'expo-go') {
      // For Expo Go, use the proxy with proper parameters
      const proxyUrl = makeRedirectUri({ 
        scheme: 'spotquest',
        preferLocalhost: false,
        isTripleSlashed: true,
      });
      // If makeRedirectUri doesn't return the proxy URL, use it directly
      return proxyUrl.includes('auth.expo') 
        ? proxyUrl 
        : 'https://auth.expo.dev/@hude/spotquest';
    }
    // For dev builds and production, use custom scheme
    return Linking.createURL('/');
  })();
  
  console.log('🔗 Redirect URI for auth:', redirectUri);
  console.log('🔗 App Ownership:', appOwnership);
  console.log('🔗 Is Expo Go:', isExpoGo);
  console.log('🔗 Is Dev Client:', isDevClient);
  console.log('🔗 Is Standalone:', isStandalone);
  console.log('🔗 Execution Environment:', Constants.executionEnvironment);
  console.log('🔗 EAS Deep Link Type:', easDeepLinkType);
  console.log('🔗 Is Device:', (Constants as any).isDevice);

  // Build II integration URL
  const iiIntegrationUrl = buildAppConnectionURL({
    dfxNetwork,
    localIPAddress: 'localhost',
    targetCanisterId: iiIntegrationCanisterId,
    pathname: '/newSession',
  });

  // Determine deep link type based on environment
  const deepLinkType = (() => {
    // Explicit setting takes priority for known values only
    if (easDeepLinkType === 'expo-go' || easDeepLinkType === 'dev-client' || easDeepLinkType === 'modern') {
      return easDeepLinkType;
    }
    if (isExpoGo) return 'expo-go';
    if (isDevClient) return 'dev-client';
    return 'modern';
  })();

  debugLog('AUTH_FLOW', '🔗 Configuration:', {
    iiIntegrationUrl: iiIntegrationUrl.toString(),
    deepLinkType,
    redirectUri,
    isExpoGo,
  });

  const iiIntegration = useIIIntegration({
    iiIntegrationUrl,
    deepLinkType,
    secureStorage,
    regularStorage,
    cryptoModule,
  });

  const { authError, isAuthReady } = iiIntegration;

  // Handle deep links that return with session-id and resume auth
  React.useEffect(() => {
    const processUrl = async (inputUrl?: string | null) => {
      if (!inputUrl) return;
      try {
        debugLog('DEEP_LINKS', '🔗 Processing URL:', inputUrl);
        const url = new URL(inputUrl);
        const sessionId = url.searchParams.get('session-id');
        if (sessionId) {
          debugLog('AUTH_FLOW', '🔗 Received session-id from deep link:', sessionId);
          try {
            await (secureStorage as any).setItem?.('expo-ii-integration.sessionId', sessionId);
          } catch (e) {
            // ignore
          }
          // Nudge the integration to re-check identity
          try {
            // @ts-ignore - not part of public types but usually present
            if (typeof iiIntegration.getIdentity === 'function') {
              await iiIntegration.getIdentity();
            }
          } catch {}
        }
      } catch {}
    };

    const sub = Linking.addEventListener('url', ({ url }) => processUrl(url));
    Linking.getInitialURL().then(processUrl);
    return () => sub.remove();
  }, [iiIntegration]);

  React.useEffect(() => {
    if (authError) {
      console.error('Auth error:', authError);
    }
  }, [authError]);

  // When we receive a session-id in a deep link, poll backend and nudge identity resolution
  React.useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    const II_CANISTER = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID || '';
    const iiBase = II_CANISTER ? `https://${II_CANISTER}.icp0.io` : '';

    const poll = async () => {
      try {
        const sessionId = await (secureStorage as any).getItem?.('expo-ii-integration.sessionId');
        if (!sessionId || !iiBase) return;
        // Check status
        const info = await fetch(`${iiBase}/api/session/${sessionId}/info`).then(r => r.json()).catch(() => null);
        debugLog('AUTH_FLOW', '🔎 Poll session info:', info);
        if (info && info.status === 'closed') {
          try {
            // Nudge integration to pick up delegation
            // @ts-ignore
            if (typeof iiIntegration.getIdentity === 'function') {
              await iiIntegration.getIdentity();
            }
          } catch {}
        }
      } catch {}
    };

    timer = setInterval(() => { if (!cancelled) poll(); }, 1000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [iiIntegration]);

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
