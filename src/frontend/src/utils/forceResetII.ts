// Force reset II integration data on app start
// This is a temporary fix for the persistent storage corruption issue

import { getSecureStorage, getRegularStorage } from '../storage';

export async function forceResetII() {
  console.log('🔥 FORCE RESETTING II INTEGRATION DATA');
  
  try {
    const secureStorage = getSecureStorage();
    const regularStorage = getRegularStorage();
    
    // List all possible keys
    const keysToRemove = [
      'expo-ii-integration.appKey',
      'expo-ii-integration.sessionId',
      'expo-ii-integration.redirectPath',
      'expo-ii-integration.identity',
      'expo-ii-integration.delegation',
      'expo-ii-integration.publicKey',
      'expo-ii-integration.privateKey',
      'expo-ii-integration.lastActivity',
      'expo-ii-integration.state',
    ];
    
    // Force remove from secure storage
    for (const key of keysToRemove) {
      try {
        await secureStorage.removeItem(key);
        console.log(`🔥 Removed ${key} from secure storage`);
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Force remove from regular storage
    for (const key of keysToRemove) {
      try {
        await regularStorage.removeItem(key);
        console.log(`🔥 Removed ${key} from regular storage`);
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Also try to find and remove by prefix
    try {
      const secureKeys = await secureStorage.find('expo-ii-integration');
      for (const key of secureKeys) {
        await secureStorage.removeItem(key);
        console.log(`🔥 Removed found key: ${key}`);
      }
    } catch (e) {
      // Ignore
    }
    
    try {
      const regularKeys = await regularStorage.find('expo-ii-integration');
      for (const key of regularKeys) {
        await regularStorage.removeItem(key);
        console.log(`🔥 Removed found key: ${key}`);
      }
    } catch (e) {
      // Ignore
    }
    
    console.log('🔥 FORCE RESET COMPLETE');
  } catch (error) {
    console.error('🔥 FORCE RESET ERROR:', error);
  }
}

// Run immediately when imported
forceResetII();