import { Platform } from 'react-native';
import { CryptoModule } from 'expo-crypto-universal';

// Complete implementation that satisfies expo-crypto-universal's CryptoModule interface
// and adds extra methods needed by expo-ii-integration
class CryptoModuleImpl implements CryptoModule {
  getRandomValues(values: Uint8Array): Uint8Array {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values);
    } else {
      // Fallback for non-secure contexts or native
      for (let i = 0; i < values.length; i++) {
        values[i] = Math.floor(Math.random() * 256);
      }
    }
    return values;
  }

  getRandomBytes(size?: number): Uint8Array {
    const length = size || 32;
    const bytes = new Uint8Array(length);
    return this.getRandomValues(bytes);
  }
}

// Export the crypto module instance
export const cryptoModule = new CryptoModuleImpl();