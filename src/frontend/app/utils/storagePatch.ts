// Patch for expo-ii-integration storage handling
// This is now just a placeholder - JSON.parse patching is handled in jsonSafeParse.ts
import { DEBUG_CONFIG, debugLog, debugWarn, debugError } from './debugConfig';

export function patchStorageForIIIntegration() {
  debugLog('STORAGE', '🔧 Storage patch activated (JSON.parse handled by jsonSafeParse.ts)');
}

// Alternative approach: Wrap the storage methods to handle the issue
export function createPatchedStorage(originalStorage: any) {
  const patchedStorage = {
    ...originalStorage,
    async getItem(key: string): Promise<string | null> {
      try {
        const value = await originalStorage.getItem(key);
        
        // Debug log
        if (key.includes('expo-ii-integration')) {
          debugLog('STORAGE', `🔧 getItem(${key}) returned:`, value);
        }
        
        // Check if the value looks like a stringified array
        if (value && typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.includes(key)) {
              debugWarn('STORAGE', `🔧 Storage returned array for key ${key}, returning null`);
              return null;
            }
          } catch (e) {
            // Not a valid JSON array, return as is
          }
        }
        
        return value;
      } catch (error) {
        debugError('STORAGE', '🔧 Error in patched getItem:', error);
        return null;
      }
    },
    
    async load(key: string): Promise<string | null> {
      return patchedStorage.getItem(key);
    },
    
    // Keep other methods as is
    async setItem(key: string, value: string): Promise<void> {
      if (key.includes('expo-ii-integration')) {
        debugLog('STORAGE', `🔧 setItem(${key}, ${value})`);
        
        // Ensure value is a string (not an array)
        if (Array.isArray(value)) {
          debugWarn('STORAGE', '🔧 setItem received array, converting to JSON string');
          value = JSON.stringify(value);
        } else if (typeof value !== 'string') {
          debugWarn('STORAGE', '🔧 setItem received non-string, converting to string');
          value = String(value);
        }
      }
      return originalStorage.setItem(key, value);
    },
    
    async save(key: string, value: string): Promise<void> {
      return patchedStorage.setItem(key, value);
    },
    
    async removeItem(key: string): Promise<void> {
      if (key.includes('expo-ii-integration')) {
        debugLog('STORAGE', `🔧 removeItem(${key})`);
      }
      return originalStorage.removeItem(key);
    },
    
    async remove(key: string): Promise<void> {
      return patchedStorage.removeItem(key);
    },
    
    async find(prefix: string): Promise<string[]> {
      const results = await originalStorage.find(prefix);
      if (prefix.includes('expo-ii-integration')) {
        debugLog('STORAGE', `🔧 find(${prefix}) returned:`, results);
      }
      return results;
    }
  };
  
  return patchedStorage;
}

// Helper function to clean up problematic storage entries
export async function cleanupIIIntegrationStorage(storage: any) {
  try {
    debugLog('STORAGE', '🔧 Cleaning up II Integration storage...');
    
    // Find all expo-ii-integration keys
    const keys = await storage.find('expo-ii-integration');
    debugLog('STORAGE', '🔧 Found keys:', keys);
    
    // Check each key and clean up if needed
    for (const key of keys) {
      const value = await storage.getItem(key);
      debugLog('STORAGE', `🔧 Key: ${key}, Value:`, value);
      
      // Special handling for appKey
      if (key === 'expo-ii-integration.appKey' && value) {
        // If the value is an array string that's already a valid Ed25519KeyIdentity format
        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            // Parse to check if it's valid
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length === 2 && 
                typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
              debugLog('STORAGE', `🔧 Key ${key} is already in correct format, keeping it`);
              continue; // Keep this key as is
            }
          } catch (e) {
            debugError('STORAGE', `🔧 Failed to parse ${key}, will remove:`, e);
          }
        }
      }
      
      // Remove keys that have array-like values but shouldn't
      if (value && value.startsWith('[') && value.endsWith(']') && key !== 'expo-ii-integration.appKey') {
        debugLog('STORAGE', `🔧 Removing problematic key: ${key}`);
        await storage.removeItem(key);
      }
    }
    
    debugLog('STORAGE', '🔧 Storage cleanup complete');
  } catch (error) {
    debugError('STORAGE', '🔧 Error during storage cleanup:', error);
  }
}