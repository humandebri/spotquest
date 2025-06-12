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
      // Use a fixed seed for consistent identity generation
      const seed = new Uint8Array(32);
      // Fixed seed values to ensure consistency
      const fixedSeed = [
        1, 2, 3, 4, 5, 6, 7, 8,
        9, 10, 11, 12, 13, 14, 15, 16,
        17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32
      ];
      for (let i = 0; i < 32; i++) {
        seed[i] = fixedSeed[i];
      }
      
      // Generate identity with fixed seed
      const identity = Ed25519KeyIdentity.generate(seed);
      const generatedPrincipal = identity.getPrincipal();
      
      // Use the provided principal or the generated one
      const principal = principalText 
        ? Principal.fromText(principalText)
        : generatedPrincipal;
      
      console.log('🔧 DEV: Generated identity principal:', generatedPrincipal.toString());
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