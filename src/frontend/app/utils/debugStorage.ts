// Debug utility to trace storage operations - DEVELOPMENT ONLY
import { DEBUG_CONFIG, debugLog } from './debugConfig';

export function debugStorage() {
  // Only enable in development and if storage debugging is enabled
  if (!__DEV__ || !DEBUG_CONFIG.STORAGE) {
    return;
  }
  
  // Intercept AsyncStorage if it exists
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (AsyncStorage) {
      const originalGetItem = AsyncStorage.getItem;
      const originalSetItem = AsyncStorage.setItem;
      const originalGetAllKeys = AsyncStorage.getAllKeys;
      
      AsyncStorage.getItem = async function(key: string) {
        const result = await originalGetItem.call(this, key);
        debugLog('STORAGE', `🔍 AsyncStorage.getItem('${key}') => ${result}`);
        return result;
      };
      
      AsyncStorage.setItem = async function(key: string, value: string) {
        debugLog('STORAGE', `🔍 AsyncStorage.setItem('${key}', '${value}')`);
        return originalSetItem.call(this, key, value);
      };
      
      AsyncStorage.getAllKeys = async function() {
        const result = await originalGetAllKeys.call(this);
        debugLog('STORAGE', `🔍 AsyncStorage.getAllKeys() => ${JSON.stringify(result)}`);
        return result;
      };
    }
  } catch (e) {
    // Silently fail if AsyncStorage not available
  }
  
  // Intercept SecureStore
  try {
    const SecureStore = require('expo-secure-store');
    if (SecureStore) {
      const originalGetItemAsync = SecureStore.getItemAsync;
      const originalSetItemAsync = SecureStore.setItemAsync;
      
      SecureStore.getItemAsync = async function(key: string) {
        const result = await originalGetItemAsync.call(this, key);
        debugLog('STORAGE', `🔍 SecureStore.getItemAsync('${key}') => ${result}`);
        return result;
      };
      
      SecureStore.setItemAsync = async function(key: string, value: string) {
        debugLog('STORAGE', `🔍 SecureStore.setItemAsync('${key}', '${value}')`);
        return originalSetItemAsync.call(this, key, value);
      };
    }
  } catch (e) {
    // Silently fail if SecureStore not available
  }
}