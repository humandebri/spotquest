// Storage interface
interface Storage {
  find?: (prefix: string) => Promise<string[]>;
  removeItem?: (key: string) => Promise<void>;
}

// Clear all expo-ii-integration related storage to fix corruption
export async function clearIIStorage(secureStorage: Storage, regularStorage: Storage) {
  console.log('🧹 Clearing expo-ii-integration storage...');
  
  try {
    // Find all expo-ii-integration keys
    const secureKeys = await secureStorage.find('expo-ii-integration');
    const regularKeys = await regularStorage.find('expo-ii-integration');
    
    console.log('🧹 Found secure keys:', secureKeys);
    console.log('🧹 Found regular keys:', regularKeys);
    
    // Clear secure storage
    for (const key of secureKeys) {
      try {
        await secureStorage.removeItem(key);
        console.log('🧹 Removed secure key:', key);
      } catch (e) {
        console.error('🧹 Failed to remove secure key:', key, e);
      }
    }
    
    // Clear regular storage
    for (const key of regularKeys) {
      try {
        await regularStorage.removeItem(key);
        console.log('🧹 Removed regular key:', key);
      } catch (e) {
        console.error('🧹 Failed to remove regular key:', key, e);
      }
    }
    
    console.log('🧹 expo-ii-integration storage cleared');
  } catch (error) {
    console.error('🧹 Error clearing storage:', error);
  }
}