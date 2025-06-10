import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
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
} from '../constants';
import { cryptoModule } from '../crypto';
import { getSecureStorage, getRegularStorage } from '../storage';

// ★ ② Safari/WebBrowserが閉じるように必須の1行
WebBrowser.maybeCompleteAuthSession();

interface IIAuthProviderProps {
  children: ReactNode;
}

// Inner component that uses the II integration hook
function IIAuthProviderInner({ children }: IIAuthProviderProps) {
  const secureStorage = getSecureStorage();
  const regularStorage = getRegularStorage();
  const isWeb = Platform.OS === 'web';

  // ③ deepLinkはルートに統一（パスなし）
  const deepLink = Linking.createURL('/');

  // Expo Goならproxy経由のAuth Sessionを使う
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: !isWeb && isExpoGo,
  });

  // ① buildAppConnectionURLでII Integration canisterのURLを生成
  // Unified canisterをII Integration Canisterとして使用
  const canisterId = CANISTER_ID_II_INTEGRATION || CANISTER_ID_UNIFIED;
  
  // Use raw URL to bypass certification requirement
  let iiIntegrationUrl: URL;
  if (DFX_NETWORK === 'local') {
    iiIntegrationUrl = new URL(`http://${canisterId}.localhost:4943`);
  } else {
    // Use .raw.icp0.io for uncertified responses
    iiIntegrationUrl = new URL(`https://${canisterId}.raw.icp0.io`);
  }

  // getDeepLinkTypeで適切なdeep link typeを自動判定
  const deepLinkType = getDeepLinkType({
    deepLink,
    frontendCanisterId: CANISTER_ID_FRONTEND,
    easDeepLinkType: process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE as any,
  });

  console.log('IIAuthProvider Configuration:', {
    iiIntegrationUrl: iiIntegrationUrl.toString(),
    deepLink,
    redirectUri,
    deepLinkType,
    isWeb,
    isExpoGo,
    executionEnvironment: Constants.executionEnvironment,
  });

  // Use the II integration hook
  const iiIntegration = useIIIntegration({
    iiIntegrationUrl,
    deepLinkType,
    secureStorage,
    regularStorage,
    cryptoModule,
  });

  // Provide the integration value to children
  return (
    <IIIntegrationProvider value={iiIntegration}>
      {children}
    </IIIntegrationProvider>
  );
}

// Main provider component
export function IIAuthProvider({ children }: IIAuthProviderProps) {
  return <IIAuthProviderInner>{children}</IIAuthProviderInner>;
}

// Re-export the context hook from expo-ii-integration
export { useIIIntegrationContext as useIIAuth } from 'expo-ii-integration';