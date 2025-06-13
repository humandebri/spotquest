// Patch for expo-ii-integration to handle edge cases
// This patches the expo-ii-integration library to handle empty storage gracefully
import { DEBUG_CONFIG, debugLog, debugError } from './debugConfig';

export function patchExpoIIIntegration() {
  debugLog('II_INTEGRATION', '🔧 Patching expo-ii-integration...');
  
  try {
    // Intercept the identity retrieval process
    const iiIntegrationModule = require('expo-ii-integration');
    
    if (iiIntegrationModule) {
      // Store the original useIIIntegration hook
      const originalUseIIIntegration = iiIntegrationModule.useIIIntegration;
      
      // Override useIIIntegration to add error handling
      iiIntegrationModule.useIIIntegration = function(config: any) {
        debugLog('II_INTEGRATION', '🔧 useIIIntegration called with config:', config);
        
        // Wrap the crypto module to monitor key generation
        if (config.cryptoModule) {
          const originalCrypto = config.cryptoModule;
          config.cryptoModule = {
            ...originalCrypto,
            getRandomValues: function(values: Uint8Array) {
              debugLog('II_INTEGRATION', `🔧 Crypto module getRandomValues called for ${values.length} bytes`);
              const result = originalCrypto.getRandomValues(values);
              
              // Check if all zeros
              const isAllZeros = values.every((byte: number) => byte === 0);
              if (isAllZeros) {
                debugError('II_INTEGRATION', '🔧 ERROR: Crypto module returned all zeros!');
                // Force generate random values
                for (let i = 0; i < values.length; i++) {
                  values[i] = Math.floor(Math.random() * 256);
                }
              }
              
              return result;
            },
            getRandomBytes: function(size?: number) {
              debugLog('II_INTEGRATION', `🔧 Crypto module getRandomBytes called for ${size} bytes`);
              return originalCrypto.getRandomBytes(size);
            }
          };
        }
        
        // Call the original hook
        const result = originalUseIIIntegration.call(this, config);
        
        // Wrap methods that might fail with empty data
        const originalLogin = result.login;
        const originalGetIdentity = result.getIdentity;
        
        result.login = async function(...args: any[]) {
          try {
            console.log('🔧 login called');
            return await originalLogin.apply(this, args);
          } catch (error: any) {
            console.error('🔧 login error:', error);
            // If it's an empty array error, handle it gracefully
            if (error.message && error.message.includes('empty array')) {
              console.log('🔧 Handling empty array error in login');
              // Clear any corrupted data and retry
              const storage = config.secureStorage || config.regularStorage;
              if (storage) {
                try {
                  await storage.removeItem('expo-ii-integration.appKey');
                  console.log('🔧 Cleared corrupted appKey');
                } catch (e) {
                  console.error('🔧 Failed to clear appKey:', e);
                }
              }
            }
            throw error;
          }
        };
        
        result.getIdentity = async function() {
          try {
            console.log('🔧 getIdentity called');
            return await originalGetIdentity.call(this);
          } catch (error: any) {
            console.error('🔧 getIdentity error:', error);
            // If it's an empty array error, return null instead of throwing
            if (error.message && (
              error.message.includes('empty array') ||
              error.message.includes('JSON must have at least 2 items')
            )) {
              console.log('🔧 Returning null for empty identity');
              return null;
            }
            throw error;
          }
        };
        
        return result;
      };
      
      console.log('🔧 expo-ii-integration patched successfully');
    }
    
    // Ed25519KeyIdentity patching is no longer needed
    // Dev mode uses a fixed test identity
    
  } catch (error) {
    console.warn('🔧 Could not patch expo-ii-integration:', error);
  }
}