import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Storage } from 'expo-ii-integration';

// Web Secure Storage implementation
export class WebSecureStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('WebSecureStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('WebSecureStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('WebSecureStorage removeItem error:', error);
      throw error;
    }
  }
}

// Native Secure Storage implementation
export class NativeSecureStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('NativeSecureStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('NativeSecureStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('NativeSecureStorage removeItem error:', error);
      throw error;
    }
  }
}

// Web Regular Storage implementation
export class WebRegularStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(`regular_${key}`);
    } catch (error) {
      console.error('WebRegularStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(`regular_${key}`, value);
    } catch (error) {
      console.error('WebRegularStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(`regular_${key}`);
    } catch (error) {
      console.error('WebRegularStorage removeItem error:', error);
      throw error;
    }
  }
}

// Native Regular Storage implementation
export class NativeRegularStorage implements Storage {
  async getItem(key: string): Promise<string | null> {
    try {
      // Use SecureStore for native regular storage as well
      // but with a different prefix
      return await SecureStore.getItemAsync(`regular_${key}`);
    } catch (error) {
      console.error('NativeRegularStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(`regular_${key}`, value);
    } catch (error) {
      console.error('NativeRegularStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(`regular_${key}`);
    } catch (error) {
      console.error('NativeRegularStorage removeItem error:', error);
      throw error;
    }
  }
}

// Factory function to get appropriate storage based on platform
export function getSecureStorage(): Storage {
  return Platform.OS === 'web' ? new WebSecureStorage() : new NativeSecureStorage();
}

export function getRegularStorage(): Storage {
  return Platform.OS === 'web' ? new WebRegularStorage() : new NativeRegularStorage();
}