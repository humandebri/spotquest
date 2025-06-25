// Storage interface
interface Storage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  find: (prefix: string) => Promise<string[]>;
}

// Wrapper for storage to handle expo-ii-integration's expectations
export class StorageWrapper implements Storage {
  constructor(private storage: Storage) {}

  async getItem(key: string): Promise<string | null> {
    console.log('🔍 StorageWrapper.getItem:', key);
    const value = await this.storage.getItem(key);
    console.log('🔍 StorageWrapper.getItem result:', value);
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    console.log('🔍 StorageWrapper.setItem:', key, value.substring(0, 100));
    await this.storage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    console.log('🔍 StorageWrapper.removeItem:', key);
    await this.storage.removeItem(key);
  }

  async find(prefix: string): Promise<string[]> {
    console.log('🔍 StorageWrapper.find:', prefix);
    const result = await this.storage.find(prefix);
    console.log('🔍 StorageWrapper.find result:', result);
    
    // If expo-ii-integration expects JSON.parse to work on the result,
    // it might be expecting a serialized array, not an actual array
    // This is a workaround for a potential bug in expo-ii-integration
    if (result && Array.isArray(result) && result.length > 0) {
      // Check if this is being called in a context where JSON.parse will be used
      // by returning a stringified version
      const caller = new Error().stack;
      if (caller && caller.includes('expo-ii-integration')) {
        console.warn('🔍 Returning stringified array for expo-ii-integration');
        return JSON.stringify(result) as any;
      }
    }
    
    return result;
  }

  // Alias methods
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