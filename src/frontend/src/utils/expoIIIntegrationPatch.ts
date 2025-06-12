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
    
    // Also try to patch Ed25519KeyIdentity generation
    try {
      const identityModule = require('@dfinity/identity');
      if (identityModule && identityModule.Ed25519KeyIdentity) {
        const originalGenerate = identityModule.Ed25519KeyIdentity.generate;
        
        identityModule.Ed25519KeyIdentity.generate = function(seed?: Uint8Array) {
          console.log('🔧 Ed25519KeyIdentity.generate called');
          
          // Always generate a proper seed if not provided or if it's all zeros
          if (!seed) {
            seed = new Uint8Array(32);
          }
          
          // Check if seed is all zeros
          const isAllZeros = seed.every((byte: number) => byte === 0);
          if (isAllZeros || !seed || seed.length !== 32) {
            console.log('🔧 Generating proper random seed...');
            seed = new Uint8Array(32);
            
            // Try expo-crypto first
            try {
              const Crypto = require('expo-crypto');
              const randomBytes = Crypto.getRandomBytes(32);
              seed.set(randomBytes);
              console.log('🔧 Used expo-crypto for seed generation');
            } catch (e) {
              // Fallback to Math.random
              console.warn('🔧 Using Math.random fallback for seed');
              for (let i = 0; i < 32; i++) {
                seed[i] = Math.floor(Math.random() * 256);
              }
            }
            
            // Log seed preview
            const preview = Array.from(seed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`🔧 Generated seed preview: ${preview}...`);
          }
          
          // Call original with proper seed
          let result;
          let attempts = 0;
          const maxAttempts = 5;
          
          while (attempts < maxAttempts) {
            attempts++;
            result = originalGenerate.call(this, seed);
            
            // Verify the generated key
            try {
              const json = result.toJSON();
              const parsed = JSON.parse(json);
              if (parsed[1] === '0000000000000000000000000000000000000000000000000000000000000000') {
                console.error(`🔧 ERROR: Attempt ${attempts} - Generated key has all-zero private key!`);
                // Generate new seed and try again
                for (let i = 0; i < 32; i++) {
                  seed[i] = Math.floor(Math.random() * 256);
                }
                continue;
              } else {
                console.log('🔧 Successfully generated key with valid private key');
                break;
              }
            } catch (e) {
              console.error('🔧 Could not verify generated key:', e);
              break;
            }
          }
          
          return result;
        };
      }
    } catch (e) {
      console.log('🔧 Could not patch Ed25519KeyIdentity.generate:', e);
    }
    
  } catch (error) {
    console.warn('🔧 Could not patch expo-ii-integration:', error);
  }
}