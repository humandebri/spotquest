// Fix for Ed25519KeyIdentity.fromJSON issues
// This patches the Ed25519KeyIdentity class to handle edge cases better
import { DEBUG_CONFIG, debugLog, debugError } from './debugConfig';

export function patchEd25519KeyIdentity() {
  try {
    // Try to access the Ed25519KeyIdentity class
    const identityModule = require('@dfinity/identity');
    if (identityModule && identityModule.Ed25519KeyIdentity) {
      const originalFromJSON = identityModule.Ed25519KeyIdentity.fromJSON;
      
      // Patch the fromJSON method
      identityModule.Ed25519KeyIdentity.fromJSON = function(json: string | any) {
        // Handle empty array case - this is not a valid identity
        if (Array.isArray(json) && json.length === 0) {
          throw new Error('Ed25519KeyIdentity.fromJSON called with empty array - no identity data available');
        }
        
        // Check if it's the find() result - an array containing the key name
        if (Array.isArray(json) && json.length === 1 && json[0] === 'expo-ii-integration.appKey') {
          // Throw the same error that the original would throw
          throw new Error('Deserialization error: JSON must have at least 2 items.');
        }
        
        // If it's already an array (parsed JSON), convert it back to string
        if (Array.isArray(json)) {
          json = JSON.stringify(json);
        }
        
        // If it's not a string, try to stringify it
        if (typeof json !== 'string') {
          try {
            json = JSON.stringify(json);
          } catch (e) {
            throw new Error('Ed25519KeyIdentity.fromJSON requires a valid JSON string');
          }
        }
        
        // Check if the JSON string represents an empty array
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed) && parsed.length === 0) {
            debugError('ED25519_FIX', '🔧 Cannot create Ed25519KeyIdentity from empty array');
            throw new Error('Ed25519KeyIdentity.fromJSON called with empty array - no identity data available');
          }
        } catch (e) {
          // Continue with original processing
        }
        
        // Call the original method
        try {
          return originalFromJSON.call(this, json);
        } catch (error) {
          // Try one more time with a clean parse/stringify cycle
          try {
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed) && parsed.length === 2) {
              const cleanJson = JSON.stringify(parsed);
              return originalFromJSON.call(this, cleanJson);
            }
          } catch (e) {
            // Fall through to original error
          }
          
          throw error;
        }
      };
    }
  } catch (error) {
    // Silently fail if patching is not possible
  }
}