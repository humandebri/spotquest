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

  async find(prefix: string): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.error('WebSecureStorage find error:', error);
      return [];
    }
  }

  // Alias for setItem (used by expo-ii-integration)
  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  // Alias for getItem (used by expo-ii-integration)
  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  // Alias for removeItem (used by expo-ii-integration)
  async remove(key: string): Promise<void> {
    return this.removeItem(key);
  }
}

// Native Secure Storage implementation
export class NativeSecureStorage implements Storage {
  private keyIndexKey = '__storage_keys_index__';

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
      // Update key index
      await this.updateKeyIndex(key, 'add');
    } catch (error) {
      console.error('NativeSecureStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      // Update key index
      await this.updateKeyIndex(key, 'remove');
    } catch (error) {
      console.error('NativeSecureStorage removeItem error:', error);
      throw error;
    }
  }

  async find(prefix: string): Promise<string[]> {
    try {
      const indexStr = await SecureStore.getItemAsync(this.keyIndexKey);
      if (!indexStr) return [];
      
      let allKeys: string[];
      try {
        allKeys = JSON.parse(indexStr) as string[];
      } catch (error) {
        console.error('Failed to parse key index, resetting:', error);
        allKeys = [];
      }
      return allKeys.filter(key => key.startsWith(prefix));
    } catch (error) {
      console.error('NativeSecureStorage find error:', error);
      return [];
    }
  }

  private async updateKeyIndex(key: string, action: 'add' | 'remove'): Promise<void> {
    try {
      const indexStr = await SecureStore.getItemAsync(this.keyIndexKey);
      let keys: string[] = [];
      if (indexStr) {
        try {
          keys = JSON.parse(indexStr);
        } catch (error) {
          console.error('Failed to parse key index, resetting:', error);
          keys = [];
        }
      }
      
      if (action === 'add' && !keys.includes(key)) {
        keys.push(key);
      } else if (action === 'remove') {
        keys = keys.filter(k => k !== key);
      }
      
      await SecureStore.setItemAsync(this.keyIndexKey, JSON.stringify(keys));
    } catch (error) {
      console.error('NativeSecureStorage updateKeyIndex error:', error);
    }
  }

  // Alias for setItem (used by expo-ii-integration)
  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  // Alias for getItem (used by expo-ii-integration)
  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  // Alias for removeItem (used by expo-ii-integration)
  async remove(key: string): Promise<void> {
    return this.removeItem(key);
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

  async find(prefix: string): Promise<string[]> {
    try {
      const keys: string[] = [];
      const searchPrefix = `regular_${prefix}`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(searchPrefix)) {
          // Remove the 'regular_' prefix from the returned keys
          keys.push(key.substring(8));
        }
      }
      return keys;
    } catch (error) {
      console.error('WebRegularStorage find error:', error);
      return [];
    }
  }

  // Alias for setItem (used by expo-ii-integration)
  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  // Alias for getItem (used by expo-ii-integration)
  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  // Alias for removeItem (used by expo-ii-integration)
  async remove(key: string): Promise<void> {
    return this.removeItem(key);
  }
}

// Native Regular Storage implementation
export class NativeRegularStorage implements Storage {
  private keyIndexKey = '__regular_storage_keys_index__';

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
      // Update key index
      await this.updateKeyIndex(key, 'add');
    } catch (error) {
      console.error('NativeRegularStorage setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(`regular_${key}`);
      // Update key index
      await this.updateKeyIndex(key, 'remove');
    } catch (error) {
      console.error('NativeRegularStorage removeItem error:', error);
      throw error;
    }
  }

  async find(prefix: string): Promise<string[]> {
    try {
      const indexStr = await SecureStore.getItemAsync(this.keyIndexKey);
      if (!indexStr) return [];
      
      let allKeys: string[];
      try {
        allKeys = JSON.parse(indexStr) as string[];
      } catch (error) {
        console.error('Failed to parse regular storage key index, resetting:', error);
        allKeys = [];
      }
      return allKeys.filter(key => key.startsWith(prefix));
    } catch (error) {
      console.error('NativeRegularStorage find error:', error);
      return [];
    }
  }

  private async updateKeyIndex(key: string, action: 'add' | 'remove'): Promise<void> {
    try {
      const indexStr = await SecureStore.getItemAsync(this.keyIndexKey);
      let keys: string[] = [];
      if (indexStr) {
        try {
          keys = JSON.parse(indexStr);
        } catch (error) {
          console.error('Failed to parse key index, resetting:', error);
          keys = [];
        }
      }
      
      if (action === 'add' && !keys.includes(key)) {
        keys.push(key);
      } else if (action === 'remove') {
        keys = keys.filter(k => k !== key);
      }
      
      await SecureStore.setItemAsync(this.keyIndexKey, JSON.stringify(keys));
    } catch (error) {
      console.error('NativeRegularStorage updateKeyIndex error:', error);
    }
  }

  // Alias for setItem (used by expo-ii-integration)
  async save(key: string, value: string): Promise<void> {
    return this.setItem(key, value);
  }

  // Alias for getItem (used by expo-ii-integration)
  async load(key: string): Promise<string | null> {
    return this.getItem(key);
  }

  // Alias for removeItem (used by expo-ii-integration)
  async remove(key: string): Promise<void> {
    return this.removeItem(key);
  }
}

// Factory function to get appropriate storage based on platform
export function getSecureStorage(): Storage {
  return Platform.OS === 'web' ? new WebSecureStorage() : new NativeSecureStorage();
}

export function getRegularStorage(): Storage {
  return Platform.OS === 'web' ? new WebRegularStorage() : new NativeRegularStorage();
}