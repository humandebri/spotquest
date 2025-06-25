// Complete reset of expo-ii-integration data
import { DEBUG_CONFIG, debugLog, debugError } from './debugConfig';

// Storage interface
interface Storage {
  getItem?: (key: string) => Promise<string | null>;
  removeItem?: (key: string) => Promise<void>;
  find?: (prefix: string) => Promise<string[]>;
}

export async function clearAllIIData(secureStorage: Storage, regularStorage: Storage) {
  debugLog('II_INTEGRATION', '🧹 Starting complete II data reset...');
  
  try {
    // List of all possible expo-ii-integration keys
    const iiKeys = [
      'expo-ii-integration.appKey',
      'expo-ii-integration.sessionId',
      'expo-ii-integration.redirectPath',
      'expo-ii-integration.identity',
      'expo-ii-integration.delegation',
      'expo-ii-integration.publicKey',
      'expo-ii-integration.privateKey',
    ];
    
    // Clear from secure storage
    for (const key of iiKeys) {
      try {
        const value = await secureStorage.getItem(key);
        if (value !== null) {
          debugLog('II_INTEGRATION', `🧹 Removing ${key} from secure storage`);
          await secureStorage.removeItem(key);
        }
      } catch (e) {
        debugLog('II_INTEGRATION', `🧹 Error checking/removing ${key}:`, e);
      }
    }
    
    // Clear from regular storage
    for (const key of iiKeys) {
      try {
        const value = await regularStorage.getItem(key);
        if (value !== null) {
          debugLog('II_INTEGRATION', `🧹 Removing ${key} from regular storage`);
          await regularStorage.removeItem(key);
        }
      } catch (e) {
        debugLog('II_INTEGRATION', `🧹 Error checking/removing ${key}:`, e);
      }
    }
    
    // Also clear any keys found by prefix search
    try {
      const secureKeys = await secureStorage.find('expo-ii-integration');
      for (const key of secureKeys) {
        debugLog('II_INTEGRATION', `🧹 Removing found key: ${key} from secure storage`);
        await secureStorage.removeItem(key);
      }
    } catch (e) {
      debugLog('II_INTEGRATION', '🧹 Error during secure storage prefix search:', e);
    }
    
    try {
      const regularKeys = await regularStorage.find('expo-ii-integration');
      for (const key of regularKeys) {
        debugLog('II_INTEGRATION', `🧹 Removing found key: ${key} from regular storage`);
        await regularStorage.removeItem(key);
      }
    } catch (e) {
      debugLog('II_INTEGRATION', '🧹 Error during regular storage prefix search:', e);
    }
    
    debugLog('II_INTEGRATION', '🧹 Complete II data reset finished');
  } catch (error) {
    debugError('II_INTEGRATION', '🧹 Error during II data reset:', error);
  }
}