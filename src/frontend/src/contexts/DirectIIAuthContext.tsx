import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// Complete auth sessions when returning from browser
WebBrowser.maybeCompleteAuthSession();

interface IIAuthContextType {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  principal: Principal | null;
  identity: Identity | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const IIAuthContext = createContext<IIAuthContextType | null>(null);

interface DirectIIAuthProviderProps {
  children: ReactNode;
}

export function DirectIIAuthProvider({ children }: DirectIIAuthProviderProps) {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Initialize auth client
  useEffect(() => {
    const init = async () => {
      try {
        const client = await AuthClient.create();
        setAuthClient(client);
        
        // Check if already authenticated
        const isAuth = await client.isAuthenticated();
        if (isAuth) {
          const identity = client.getIdentity();
          const principal = identity.getPrincipal();
          setIdentity(identity);
          setPrincipal(principal);
          setIsAuthenticated(true);
        }
        
        setIsAuthReady(true);
      } catch (error) {
        console.error('Failed to initialize auth client:', error);
        setAuthError('Failed to initialize authentication');
        setIsAuthReady(true);
      }
    };
    
    init();
  }, []);

  const login = async () => {
    if (!authClient) {
      setAuthError('Auth client not initialized');
      return;
    }

    try {
      setAuthError(null);
      
      // For mobile, we need to use a different approach
      if (Platform.OS !== 'web') {
        // Open Internet Identity in browser
        const iiUrl = 'https://identity.ic0.app';
        const result = await WebBrowser.openAuthSessionAsync(
          iiUrl,
          Linking.createURL('auth')
        );
        
        if (result.type === 'success') {
          // Handle the auth result
          console.log('Auth result:', result);
          // Note: This simplified approach may need additional work for mobile
        }
      } else {
        // Web implementation
        await new Promise<void>((resolve, reject) => {
          authClient.login({
            identityProvider: 'https://identity.ic0.app',
            onSuccess: () => {
              const identity = authClient.getIdentity();
              const principal = identity.getPrincipal();
              setIdentity(identity);
              setPrincipal(principal);
              setIsAuthenticated(true);
              resolve();
            },
            onError: (error) => {
              console.error('Login error:', error);
              setAuthError(error?.message || 'Login failed');
              reject(error);
            },
          });
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const logout = async () => {
    if (!authClient) return;
    
    try {
      await authClient.logout();
      setIdentity(null);
      setPrincipal(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      setAuthError(error instanceof Error ? error.message : 'Logout failed');
    }
  };

  const clearAuthError = () => setAuthError(null);

  const value: IIAuthContextType = {
    isAuthReady,
    isAuthenticated,
    principal,
    identity,
    login,
    logout,
    authError,
    clearAuthError,
  };

  return (
    <IIAuthContext.Provider value={value}>
      {children}
    </IIAuthContext.Provider>
  );
}

export function useDirectIIAuth() {
  const context = useContext(IIAuthContext);
  if (!context) {
    throw new Error('useDirectIIAuth must be used within DirectIIAuthProvider');
  }
  return context;
}

// Re-export as useIIAuth for compatibility
export { useDirectIIAuth as useIIAuth } from './DirectIIAuthContext';