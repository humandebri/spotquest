// Script to clear all storage data for debugging
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function clearAllStorage() {
  console.log('🧹 Clearing all storage data...');
  
  try {
    if (Platform.OS === 'web') {
      // Clear localStorage
      localStorage.clear();
      console.log('✅ localStorage cleared');
      
      // Clear sessionStorage
      sessionStorage.clear();
      console.log('✅ sessionStorage cleared');
    } else {
      // Skip AsyncStorage for now as we don't have it imported
      // await AsyncStorage.clear();
      console.log('⚠️ AsyncStorage clear skipped');
      
      // Clear known SecureStore keys
      const keysToDelete = [
        '__storage_keys_index__',
        '__regular_storage_keys_index__',
        'ii_encryption_key',
        'auth_session_id',
        'delegation',
        'authenticated',
      ];
      
      for (const key of keysToDelete) {
        try {
          await SecureStore.deleteItemAsync(key);
          console.log(`✅ Deleted SecureStore key: ${key}`);
        } catch (error) {
          // Key might not exist
        }
      }
      
      // Try to clear any prefixed keys
      const prefixes = ['ii_auth_', 'regular_'];
      for (const prefix of prefixes) {
        for (let i = 0; i < 100; i++) {
          try {
            await SecureStore.deleteItemAsync(`${prefix}${i}`);
          } catch (error) {
            // Key might not exist
          }
        }
      }
    }
    
    console.log('✅ All storage cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
  }
}

// Export for use in app
export default clearAllStorage;