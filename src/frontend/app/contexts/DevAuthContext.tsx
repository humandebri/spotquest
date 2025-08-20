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
      
      // Generate a deterministic test key based on a fixed seed
      // This ensures the same key is generated every time for dev mode
      const generateTestKey = (): Uint8Array => {
        // Use a fixed seed string that's not a real private key
        const FIXED_SEED = 'spotquest-dev-mode-test-key-2024';
        
        // Simple hash function to generate consistent bytes from seed
        const key = new Uint8Array(32);
        let hash = 0x12345678; // Start with a fixed value
        
        for (let i = 0; i < FIXED_SEED.length; i++) {
          hash = ((hash << 5) - hash) + FIXED_SEED.charCodeAt(i);
          hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Fill key with deterministic values based on hash
        for (let i = 0; i < 32; i++) {
          // Use multiple operations to ensure good distribution
          const value = (hash * (i + 1) * 0x45d9f3b + i * 0x1234567) >>> 0;
          key[i] = value & 0xff;
          // Update hash for next iteration
          hash = (hash * 0x343fd + 0x269ec3) >>> 0;
        }
        
        return key;
      };
      
      const TEST_SECRET_KEY = generateTestKey();
      
      console.log('🔧 DEV: Using deterministic test key for dev mode');
      
      const identity = Ed25519KeyIdentity.fromSecretKey(TEST_SECRET_KEY.buffer as ArrayBuffer);
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