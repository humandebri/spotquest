/**
 * Script to clear all authentication data
 * Run with: npx ts-node clearAuthData.ts
 */
import { getSecureStorage, getRegularStorage } from './src/storage';
import { clearAllIIData } from './src/utils/clearAllIIData';

async function clearAuth() {
  console.log('🧹 Clearing all authentication data...');
  
  const secureStorage = getSecureStorage();
  const regularStorage = getRegularStorage();
  
  try {
    await clearAllIIData(secureStorage, regularStorage);
    console.log('✅ All authentication data cleared successfully!');
    console.log('Please restart the app to continue.');
  } catch (error) {
    console.error('❌ Failed to clear authentication data:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  clearAuth();
}