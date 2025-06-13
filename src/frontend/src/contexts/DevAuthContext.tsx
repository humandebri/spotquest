// Development authentication context for testing without Internet Identity
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Principal } from '@dfinity/principal';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { useIIAuthStore } from '../store/iiAuthStore';
import { DEBUG_CONFIG, debugLog } from '../utils/debugConfig';

interface DevAuthContextType {
  loginAsDev: (principalText?: string) => Promise<void>;
  isDevMode: boolean;
}

const DevAuthContext = createContext<DevAuthContextType>({
  loginAsDev: async () => {},
  isDevMode: false,
});

export function useDevAuth() {
  return useContext(DevAuthContext);
}

interface DevAuthProviderProps {
  children: ReactNode;
}

export function DevAuthProvider({ children }: DevAuthProviderProps) {
  const [isDevMode, setIsDevMode] = useState(false);
  const { setAuthenticated } = useIIAuthStore();

  const loginAsDev = useCallback(async (principalText?: string) => {
    debugLog('AUTH_FLOW', '🔧 DEV: Logging in with dev credentials');
    
    try {
      // Use a fixed test Ed25519 key for dev mode
      // This is a well-known test key that works properly
      console.log('🔧 DEV: Creating Ed25519KeyIdentity with fixed test key');
      
      // This is a properly formatted test private key (32 bytes)
      const TEST_SECRET_KEY = new Uint8Array([
        0x94, 0xeb, 0x94, 0xd7, 0x20, 0x2f, 0x2b, 0x87,
        0x7b, 0x12, 0x1f, 0x87, 0xfa, 0x85, 0x42, 0x2e,
        0x38, 0xf4, 0x7e, 0xd9, 0x16, 0xcc, 0xad, 0x37,
        0xa2, 0x42, 0xc8, 0xd8, 0xee, 0x6f, 0xb9, 0xc0
      ]);
      
      const identity = Ed25519KeyIdentity.fromSecretKey(TEST_SECRET_KEY.buffer);
      const generatedPrincipal = identity.getPrincipal();
      
      console.log('🔧 DEV: Test identity principal:', generatedPrincipal.toString());
      
      // Use the provided principal or the test identity principal
      const principal = principalText 
        ? Principal.fromText(principalText)
        : generatedPrincipal;
      
      console.log('🔧 DEV: Using principal:', principal.toString());
      
      // Store the principal for future minting if needed
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('devPrincipal', principal.toString());
      }
      
      // Set authenticated state
      setAuthenticated(principal, identity);
      setIsDevMode(true);
      
      console.log('🔧 DEV: setAuthenticated called, setIsDevMode called');
      
      // Store dev mode flag
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('devMode', 'true');
      }
      
      // Force a small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🔧 DEV: Login complete');
    } catch (error) {
      console.error('🔧 DEV: Login error:', error);
      throw error;
    }
  }, [setAuthenticated]);

  return (
    <DevAuthContext.Provider value={{ loginAsDev, isDevMode }}>
      {children}
    </DevAuthContext.Provider>
  );
}