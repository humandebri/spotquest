import React, { ReactNode } from 'react';
import { Platform, View, Text } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { 
  IIIntegrationProvider, 
  useIIIntegration,
} from 'expo-ii-integration';
import { getDeepLinkType } from 'expo-icp-frontend-helpers';
import {
  LOCAL_IP_ADDRESS,
  DFX_NETWORK,
  CANISTER_ID_II_INTEGRATION,
  CANISTER_ID_FRONTEND,
  CANISTER_ID_UNIFIED,
} from '../constants/index';
import { cryptoModule } from '../crypto';
import { getSecureStorage, getRegularStorage } from '../storage';
import { createPatchedStorage, cleanupIIIntegrationStorage } from '../utils/storagePatch';
import { FixedSecureStorage, FixedRegularStorage, checkAndFixAppKey } from '../utils/iiIntegrationStorageFix';
import { clearAllIIData } from '../utils/clearAllIIData';
import { DEBUG_CONFIG, debugLog } from '../utils/debugConfig';

// ★ ② Safari/WebBrowserが閉じるように必須の1行
WebBrowser.maybeCompleteAuthSession();

interface IIAuthProviderProps {
  children: ReactNode;
}

// Inner component that uses the II integration hook
function IIAuthProviderInner({ children }: IIAuthProviderProps) {
  const baseSecureStorage = getSecureStorage();
  const baseRegularStorage = getRegularStorage();
  
  // Use fixed storage wrappers to handle expo-ii-integration properly
  const secureStorage = new FixedSecureStorage(createPatchedStorage(baseSecureStorage));
  const regularStorage = new FixedRegularStorage(createPatchedStorage(baseRegularStorage));
  
  // Don't automatically clear II data - let the user choose to reset if needed
  // const [dataCleared, setDataCleared] = React.useState(false);
  
  // React.useEffect(() => {
  //   // Only clear data once on initial mount
  //   if (!dataCleared) {
  //     clearAllIIData(secureStorage, regularStorage).then(() => {
  //       setDataCleared(true);
  //       console.log('🧹 II data cleared for fresh start');
  //     });
  //   }
  // }, [dataCleared]);
  
  const isWeb = Platform.OS === 'web';

  // Check if running in Expo Go for debugging
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  // ③ deepLinkはルートに統一（パスなし）
  // For Expo Go, we need to use the auth path for proper redirect
  const deepLink = isExpoGo ? Linking.createURL('auth') : Linking.createURL('/');
  
  // For debugging: log the actual deep link
  debugLog('DEEP_LINKS', '🔗 Deep link for II redirect:', deepLink);
  debugLog('DEEP_LINKS', '🔗 Is Expo Go:', isExpoGo);

  // ① buildAppConnectionURLでII Integration canisterのURLを生成
  // Unified canisterをII Integration Canisterとして使用
  const canisterId = CANISTER_ID_II_INTEGRATION || CANISTER_ID_UNIFIED;
  
  // Always use mainnet URL - never localhost for physical devices
  // Use .raw.icp0.io for uncertified responses
  const iiIntegrationUrl = new URL(`https://${canisterId}.raw.icp0.io`);

  // getDeepLinkTypeで適切なdeep link typeを自動判定
  let deepLinkType;
  try {
    deepLinkType = getDeepLinkType({
      deepLink,
      frontendCanisterId: CANISTER_ID_FRONTEND,
      easDeepLinkType: process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE as any,
    });
  } catch (error) {
    console.warn('⚠️ getDeepLinkType error:', error);
    console.warn('⚠️ Using fallback deepLinkType for:', deepLink);
    
    // Fallback: spotquest:/// をルートとして扱う
    if (deepLink.includes('spotquest://')) {
      deepLinkType = 'custom-scheme'; // または 'url-scheme'
    } else {
      deepLinkType = 'universal-link';
    }
  }

  debugLog('II_INTEGRATION', 'IIAuthProvider Configuration:', {
    iiIntegrationUrl: iiIntegrationUrl.toString(),
    deepLink,
    deepLinkType,
    isWeb,
    isExpoGo,
    executionEnvironment: Constants.executionEnvironment,
  });

  // Log crypto module to ensure it's being used
  debugLog('II_INTEGRATION', '🔐 Crypto module provided to useIIIntegration:', {
    hasGetRandomValues: typeof cryptoModule.getRandomValues === 'function',
    hasGetRandomBytes: typeof cryptoModule.getRandomBytes === 'function',
  });
  
  // Use the II integration hook
  const iiIntegration = useIIIntegration({
    iiIntegrationUrl,
    deepLinkType,
    secureStorage: secureStorage as any,
    regularStorage: regularStorage as any,
    cryptoModule,
  });
  
  // Monitor authentication flow
  React.useEffect(() => {
    console.log('🔗 II Integration state:', {
      isAuthenticated: iiIntegration.isAuthenticated,
      isAuthReady: iiIntegration.isAuthReady,
      authError: iiIntegration.authError,
    });
    
    // Check session storage
    regularStorage.getItem('expo-ii-integration.sessionId').then(sessionId => {
      if (sessionId) {
        console.log('🔗 Session ID present:', sessionId.substring(0, 10) + '...');
      }
    });
    
    // Check delegation storage
    regularStorage.getItem('expo-ii-integration.delegation').then(delegation => {
      if (delegation) {
        console.log('🔗 Delegation present in storage');
      }
    });
    
    // Also check all II-related storage keys
    regularStorage.find('expo-ii-integration').then(keys => {
      console.log('🔗 All II storage keys:', keys);
      keys.forEach(key => {
        regularStorage.getItem(key).then(value => {
          console.log(`🔗 ${key}:`, value ? value.substring(0, 50) + '...' : 'null');
        });
      });
    });
  }, [iiIntegration.isAuthenticated, iiIntegration.isAuthReady]);
  
  // Debug: Log any network requests and test the II integration URL
  React.useEffect(() => {
    console.log('🔍 II Integration URL:', iiIntegrationUrl.toString());
    
    // Test fetch to see what the II integration URL returns
    const testIIIntegrationUrl = async () => {
      try {
        const testUrl = iiIntegrationUrl.toString();
        console.log('🔍 Testing II Integration URL:', testUrl);
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
          },
        });
        
        const contentType = response.headers.get('content-type');
        console.log('🔍 II Integration response content-type:', contentType);
        console.log('🔍 II Integration response status:', response.status);
        
        const text = await response.text();
        console.log('🔍 II Integration response preview:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        
        if (contentType && contentType.includes('text/html')) {
          console.warn('⚠️ II Integration URL is returning HTML instead of expected response!');
        }
      } catch (error) {
        console.error('🔍 Error testing II Integration URL:', error);
      }
    };
    
    testIIIntegrationUrl();
  }, []);

  // Provide the integration value to children
  return (
    <IIIntegrationProvider value={iiIntegration}>
      {children}
    </IIIntegrationProvider>
  );
}

// Main provider component
export function IIAuthProvider({ children }: IIAuthProviderProps) {
  // Monitor auth session completion
  React.useEffect(() => {
    const checkAuthSession = async () => {
      const result = await WebBrowser.maybeCompleteAuthSession();
      console.log('🔍 Auth session completion check:', result);
    };
    
    checkAuthSession();
  }, []);
  
  return <IIAuthProviderInner>{children}</IIAuthProviderInner>;
}

// Re-export the context hook from expo-ii-integration
export { useIIIntegrationContext as useIIAuth } from 'expo-ii-integration';