// Fix for expo-ii-integration storage issues
// This provides a proper wrapper for storage to handle the appKey correctly

import { Storage } from 'expo-ii-integration';

export class FixedSecureStorage implements Storage {
  constructor(private originalStorage: Storage) {}

  async getItem(key: string): Promise<string | null> {
    const value = await this.originalStorage.getItem(key);
    
    // Debug logging
    if (key.includes('expo-ii-integration')) {
      console.log(`🔧 FixedSecureStorage.getItem('${key}') =>`, value);
    }
    
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    // Ensure value is a string (not an array)
    if (Array.isArray(value)) {
      console.warn('🔧 FixedSecureStorage.setItem received array, converting to JSON string');
      value = JSON.stringify(value);
    } else if (typeof value !== 'string') {
      console.warn('🔧 FixedSecureStorage.setItem received non-string, converting to string');
      value = String(value);
    }
    
    // Debug logging
    if (key.includes('expo-ii-integration')) {
      debugLog('II_INTEGRATION', `🔧 FixedSecureStorage.setItem('${key}', ${value})`);
      
      // Check if we're setting an appKey with all-zero private key
      if (key === 'expo-ii-integration.appKey') {
        try {
          // Handle comma-separated format from toJSON()
          let parsed;
          if (value.includes('[') && value.includes(']')) {
            parsed = JSON.parse(value);
          } else if (value.includes(',')) {
            // Handle "publicKey,privateKey" format
            const parts = value.split(',');
            if (parts.length === 2) {
              parsed = parts;
            }
          }
          
          if (parsed && Array.isArray(parsed) && parsed.length === 2 && 
              parsed[1] === '0000000000000000000000000000000000000000000000000000000000000000') {
            console.error('🔧 ERROR: Attempting to store appKey with all-zero private key!');
            console.error('🔧 Generating new valid key pair with proper randomness...');
            
            // Generate a truly random seed
            const seed = new Uint8Array(32);
            
            // Use expo-crypto for native
            try {
              const Crypto = require('expo-crypto');
              const randomBytes = Crypto.getRandomBytes(32);
              seed.set(randomBytes);
              console.log('🔧 Used expo-crypto for seed');
            } catch (e) {
              // Fallback
              console.warn('🔧 Using Math.random fallback for seed');
              for (let i = 0; i < 32; i++) {
                seed[i] = Math.floor(Math.random() * 256);
              }
            }
            
            // Log seed preview
            const seedPreview = Array.from(seed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`🔧 Seed preview: ${seedPreview}...`);
            
            // Generate a new valid Ed25519 key pair with the seed
            const Ed25519KeyIdentity = require('@dfinity/identity').Ed25519KeyIdentity;
            const newIdentity = Ed25519KeyIdentity.generate(seed);
            const newJson = newIdentity.toJSON();
            
            console.log('🔧 Generated new valid key pair, JSON:', newJson);
            
            // Ensure it's properly formatted as JSON string
            if (!newJson.startsWith('[')) {
              // Convert comma-separated to proper JSON array
              const parts = newJson.split(',');
              value = JSON.stringify(parts);
            } else {
              value = newJson;
            }
            
            console.log('🔧 Final value to store:', value);
          }
        } catch (e) {
          console.error('🔧 Error checking/fixing appKey:', e);
        }
      }
    }
    
    return this.originalStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (key.includes('expo-ii-integration')) {
      console.log(`🔧 FixedSecureStorage.removeItem('${key}')`);
    }
    
    return this.originalStorage.removeItem(key);
  }

  async find(prefix: string): Promise<string[]> {
    const results = await this.originalStorage.find(prefix);
    
    if (prefix.includes('expo-ii-integration')) {
      console.log(`🔧 FixedSecureStorage.find('${prefix}') =>`, results);
      
      // HACK: expo-ii-integration has a bug where it calls find('expo-ii-integration.appKey')
      // and then passes the result directly to Ed25519KeyIdentity.fromJSON
      // Instead of returning key names, we need to return the actual value
      if (prefix === 'expo-ii-integration.appKey' && results && results.length > 0) {
        console.log('🔧 HACK: expo-ii-integration bug workaround - fetching actual appKey value');
        try {
          const appKeyValue = await this.getItem('expo-ii-integration.appKey');
          if (appKeyValue) {
            // Parse and return as array to match what Ed25519KeyIdentity expects
            const parsed = JSON.parse(appKeyValue);
            if (Array.isArray(parsed) && parsed.length === 2) {
              console.log('🔧 Returning actual appKey value instead of key name');
              return parsed;
            }
          }
        } catch (e) {
          console.error('🔧 Failed to fetch appKey value:', e);
        }
      }
      
      // Make sure we're returning key names, not values
      if (results && Array.isArray(results)) {
        // Filter out any non-string values (shouldn't happen, but just in case)
        const validKeys = results.filter(item => typeof item === 'string');
        
        // Check if any result looks like a JSON array (stored value instead of key)
        const problematicResults = validKeys.some(item => 
          item.startsWith('[') && item.endsWith(']')
        );
        
        if (problematicResults) {
          console.warn('🔧 find() returned values instead of keys, this might be a storage implementation issue');
        }
        
        return validKeys;
      }
    }
    
    return results || [];
  }

  // Aliases for expo-ii-integration
  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  async remove(key: string): Promise<void> {
    return this.removeItem(key);
  }
}

// Similar wrapper for regular storage
export class FixedRegularStorage implements Storage {
  constructor(private originalStorage: Storage) {}

  async getItem(key: string): Promise<string | null> {
    return this.originalStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    return this.originalStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    return this.originalStorage.removeItem(key);
  }

  async find(prefix: string): Promise<string[]> {
    const results = await this.originalStorage.find(prefix);
    return results || [];
  }

  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  async remove(key: string): Promise<void> {
    return this.removeItem(key);
  }
}

// Helper to check and fix existing appKey data
export async function checkAndFixAppKey(storage: Storage): Promise<void> {
  try {
    const appKeyValue = await storage.getItem('expo-ii-integration.appKey');
    console.log('🔧 Current appKey value:', appKeyValue);
    
    if (appKeyValue) {
      // Check if it's a valid JSON string of an array
      try {
        const parsed = JSON.parse(appKeyValue);
        if (Array.isArray(parsed) && parsed.length === 2 && 
            typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
          console.log('🔧 appKey is valid Ed25519KeyIdentity format');
        } else {
          console.warn('🔧 appKey has invalid format, removing it');
          await storage.removeItem('expo-ii-integration.appKey');
        }
      } catch (e) {
        console.error('🔧 Failed to parse appKey, removing it:', e);
        await storage.removeItem('expo-ii-integration.appKey');
      }
    }
  } catch (error) {
    console.error('🔧 Error checking appKey:', error);
  }
}