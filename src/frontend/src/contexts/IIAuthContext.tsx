import React, { createContext, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { 
  IIIntegrationProvider, 
  useIIIntegration,
  DeepLinkType,
} from 'expo-ii-integration';
import { buildAppConnectionURL } from 'expo-icp-app-connect-helpers';
import { getDeepLinkType } from 'expo-icp-frontend-helpers';
import {
  LOCAL_IP_ADDRESS,
  DFX_NETWORK,
  CANISTER_ID_II_INTEGRATION,
  CANISTER_ID_FRONTEND,
  APP_SCHEME,
} from '../constants';
import { cryptoModule } from '../crypto';
import { getSecureStorage, getRegularStorage } from '../storage';

// Create a context for the auth
const IIAuthContext = createContext<ReturnType<typeof useIIIntegration> | null>(null);

interface IIAuthProviderProps {
  children: ReactNode;
}

export function IIAuthProvider({ children }: IIAuthProviderProps) {
  const isWeb = Platform.OS === 'web';
  const secureStorage = getSecureStorage();
  const regularStorage = getRegularStorage();

  // Create deep link URL
  const deepLink = Linking.createURL('/');
  
  // Build II integration URL
  const iiIntegrationUrl = buildAppConnectionURL({
    dfxNetwork: DFX_NETWORK,
    localIPAddress: LOCAL_IP_ADDRESS,
    targetCanisterId: CANISTER_ID_II_INTEGRATION || CANISTER_ID_FRONTEND, // Fallback to frontend if no II integration canister
  });
  
  // Get deep link type
  const deepLinkType = getDeepLinkType({
    deepLink,
    frontendCanisterId: CANISTER_ID_FRONTEND,
    easDeepLinkType: process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE as DeepLinkType | undefined,
  });
  
  // Initialize II integration
  const iiIntegration = useIIIntegration({
    iiIntegrationUrl,
    deepLinkType,
    secureStorage,
    regularStorage,
    cryptoModule,
  });

  return (
    <IIIntegrationProvider value={iiIntegration}>
      <IIAuthContext.Provider value={iiIntegration}>
        {children}
      </IIAuthContext.Provider>
    </IIIntegrationProvider>
  );
}

// Hook to use II auth context
export function useIIAuth() {
  const context = useContext(IIAuthContext);
  if (!context) {
    throw new Error('useIIAuth must be used within IIAuthProvider');
  }
  return context;
}