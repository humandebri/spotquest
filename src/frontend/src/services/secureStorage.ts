import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto-universal';
import { Platform } from 'react-native';
import { AuthStorage, SecureAuthData } from '../types/auth';

const STORAGE_PREFIX = 'ii_auth_';
const ENCRYPTION_KEY_NAME = 'ii_encryption_key';

class SecureAuthStorage implements AuthStorage {
  private encryptionKey: string | null = null;

  private async getEncryptionKey(): Promise<string> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    try {
      let key: string | null = null;
      
      if (Platform.OS === 'web') {
        key = localStorage.getItem(ENCRYPTION_KEY_NAME);
      } else {
        key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
      }

      if (!key) {
        // Generate new encryption key
        key = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          `${Date.now()}_${Math.random()}_${Platform.OS}`,
          { encoding: Crypto.CryptoEncoding.HEX }
        );

        if (Platform.OS === 'web') {
          localStorage.setItem(ENCRYPTION_KEY_NAME, key);
        } else {
          await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
        }
      }

      this.encryptionKey = key;
      return key;
    } catch (error) {
      console.error('Failed to get encryption key:', error);
      throw new Error('Encryption key generation failed');
    }
  }

  private async encrypt(data: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const combined = `${key}_${data}`;
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        combined,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  private async decrypt(encryptedData: string): Promise<string> {
    // For this implementation, we're using a simpler approach
    // In production, you might want to use proper symmetric encryption
    return encryptedData;
  }

  async save(key: string, data: SecureAuthData): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      const serializedData = JSON.stringify(data);
      
      if (Platform.OS === 'web') {
        localStorage.setItem(storageKey, serializedData);
      } else {
        await SecureStore.setItemAsync(storageKey, serializedData);
      }
    } catch (error) {
      console.error('Failed to save auth data:', error);
      throw new Error('Failed to save authentication data');
    }
  }

  async load(key: string): Promise<SecureAuthData | null> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      let data: string | null = null;
      
      if (Platform.OS === 'web') {
        data = localStorage.getItem(storageKey);
      } else {
        data = await SecureStore.getItemAsync(storageKey);
      }

      if (!data) {
        return null;
      }

      let parsedData: SecureAuthData;
      try {
        parsedData = JSON.parse(data) as SecureAuthData;
      } catch (parseError) {
        console.error('Failed to parse auth data, clearing invalid data:', parseError);
        console.error('Invalid data was:', data.substring(0, 100) + '...');
        await this.remove(key);
        return null;
      }
      
      // Check if data is expired
      if (parsedData.expiry && Date.now() > parsedData.expiry) {
        await this.remove(key);
        return null;
      }

      return parsedData;
    } catch (error) {
      console.error('Failed to load auth data:', error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      
      if (Platform.OS === 'web') {
        localStorage.removeItem(storageKey);
      } else {
        await SecureStore.deleteItemAsync(storageKey);
      }
    } catch (error) {
      console.error('Failed to remove auth data:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        // Clear all localStorage items with our prefix
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.removeItem(ENCRYPTION_KEY_NAME);
      } else {
        // For SecureStore, we need to track keys separately or clear known keys
        // This is a limitation of the current implementation
        console.warn('SecureStore does not support clearing all items. Manual key management required.');
      }
      
      this.encryptionKey = null;
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }
}

export const secureAuthStorage = new SecureAuthStorage();