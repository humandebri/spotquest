import { Platform } from 'react-native';
import { CryptoModule } from 'expo-crypto-universal';
import * as Crypto from 'expo-crypto';

// Complete implementation that satisfies expo-crypto-universal's CryptoModule interface
// and adds extra methods needed by expo-ii-integration
class CryptoModuleImpl implements CryptoModule {
  getRandomValues(values: Uint8Array): Uint8Array {
    console.log(`🔐 getRandomValues called for ${values.length} bytes`);
    
    // Use expo-crypto's getRandomBytes for better randomness on native
    if (Platform.OS !== 'web') {
      try {
        // Generate random bytes using expo-crypto
        const randomBytes = Crypto.getRandomBytes(values.length);
        
        // Verify we got actual random bytes
        let hasNonZero = false;
        for (let i = 0; i < randomBytes.length; i++) {
          if (randomBytes[i] !== 0) {
            hasNonZero = true;
            break;
          }
        }
        
        if (!hasNonZero) {
          console.error('🔐 ERROR: expo-crypto returned all zeros!');
          // Use timestamp-based seeding as emergency fallback
          const timestamp = Date.now();
          const rand = Math.random() * 1000000;
          
          // Generate pseudo-random bytes based on timestamp and Math.random
          for (let i = 0; i < values.length; i++) {
            // Mix timestamp, random, and index to create byte values
            const mixed = (timestamp + rand + i * 137 + (i * i * 31)) % 256;
            values[i] = Math.floor(mixed);
          }
          
          console.log('🔐 Used timestamp-based fallback for randomness');
        } else {
          values.set(randomBytes);
          console.log('🔐 Successfully got random bytes from expo-crypto');
        }
        
        return values;
      } catch (e) {
        console.error('🔐 Error using expo-crypto:', e);
        // Fall through to other methods
      }
    }
    
    // Web: use built-in crypto
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values);
    } else {
      // Fallback for non-secure contexts
      console.warn('🔐 Using Math.random fallback for crypto - NOT SECURE!');
      for (let i = 0; i < values.length; i++) {
        values[i] = Math.floor(Math.random() * 256);
      }
    }
    
    // Debug: log first few bytes to ensure they're not all zeros
    const preview = Array.from(values.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`🔐 Generated random bytes preview: ${preview}...`);
    
    return values;
  }

  getRandomBytes(size?: number): Uint8Array {
    const length = size || 32;
    console.log(`🔐 getRandomBytes called for ${length} bytes`);
    const bytes = new Uint8Array(length);
    return this.getRandomValues(bytes);
  }
}

// Export the crypto module instance
export const cryptoModule = new CryptoModuleImpl();