// Fix for missing delegation after II authentication
// This manually extracts and stores the delegation from the URL

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export async function checkAndFixDelegation(storage: any) {
  console.log('🔐 Checking for delegation fix...');
  
  try {
    // Check if delegation already exists
    const existingDelegation = await storage.getItem('expo-ii-integration.delegation');
    if (existingDelegation) {
      console.log('🔐 Delegation already exists');
      return true;
    }
    
    // Get the current URL
    const url = await Linking.getInitialURL();
    if (!url) {
      console.log('🔐 No URL available');
      return false;
    }
    
    console.log('🔐 Checking URL for delegation:', url);
    
    // Parse the URL to look for delegation data
    try {
      const urlObj = new URL(url);
      const hash = urlObj.hash;
      const search = urlObj.search;
      
      // Check both hash and search params
      let delegationData = null;
      
      // Check hash fragment
      if (hash && hash.includes('delegation')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        delegationData = hashParams.get('delegation');
      }
      
      // Check search params
      if (!delegationData && search) {
        const searchParams = new URLSearchParams(search);
        delegationData = searchParams.get('delegation');
      }
      
      if (delegationData) {
        console.log('🔐 Found delegation in URL!');
        await storage.setItem('expo-ii-integration.delegation', delegationData);
        return true;
      }
    } catch (e) {
      console.error('🔐 Error parsing URL:', e);
    }
    
    // Try to get delegation from session storage (web)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const webDelegation = window.sessionStorage.getItem('expo-ii-integration.delegation');
        if (webDelegation) {
          console.log('🔐 Found delegation in web session storage');
          await storage.setItem('expo-ii-integration.delegation', webDelegation);
          return true;
        }
      } catch (e) {
        console.error('🔐 Error checking web storage:', e);
      }
    }
    
    console.log('🔐 No delegation found to fix');
    return false;
  } catch (error) {
    console.error('🔐 Error in delegation fix:', error);
    return false;
  }
}

// Mock delegation for testing (NOT for production!)
export async function createMockDelegation(storage: any) {
  console.warn('🔐 Creating MOCK delegation - FOR TESTING ONLY!');
  
  const mockDelegation = {
    delegations: [{
      delegation: {
        pubkey: '0x123456',
        expiration: Date.now() + 3600000, // 1 hour
        targets: []
      },
      signature: '0xMOCK_SIGNATURE'
    }]
  };
  
  await storage.setItem('expo-ii-integration.delegation', JSON.stringify(mockDelegation));
  console.warn('🔐 Mock delegation created - Authentication will not work with real canisters!');
}