// Polyfills for @dfinity/agent in React Native
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import process from 'process';
import 'react-native-url-polyfill/auto';
import * as ExpoCrypto from 'expo-crypto';

// TextEncoder/TextDecoder polyfill
// Use react-native's built-in TextEncoder/TextDecoder if available,
// otherwise provide a simple implementation
if (typeof global.TextEncoder === 'undefined') {
  // Simple TextEncoder implementation
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const utf8 = unescape(encodeURIComponent(str));
      const result = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) {
        result[i] = utf8.charCodeAt(i);
      }
      return result;
    }
  } as any;
}

if (typeof global.TextDecoder === 'undefined') {
  // Simple TextDecoder implementation
  global.TextDecoder = class TextDecoder {
    decode(arr: Uint8Array): string {
      let str = '';
      for (let i = 0; i < arr.length; i++) {
        str += String.fromCharCode(arr[i]);
      }
      return decodeURIComponent(escape(str));
    }
  } as any;
}

// Crypto polyfill for React Native
if (typeof global.crypto === 'undefined') {
  console.log('Setting up crypto polyfill...');
  
  // For React Native, we'll use expo-crypto
  global.crypto = {
    getRandomValues: (array: any) => {
      try {
        // Use expo-crypto for secure random values
        const randomBytes = ExpoCrypto.getRandomBytes(array.length);
        
        // Copy bytes to the input array
        for (let i = 0; i < array.length; i++) {
          array[i] = randomBytes[i];
        }
        
        return array;
      } catch (error) {
        console.warn('Crypto.getRandomValues error:', error);
        // Fallback to Math.random with better seeding
        const timestamp = Date.now();
        const rand = Math.random() * 1000000;
        
        for (let i = 0; i < array.length; i++) {
          // Use a more complex formula for better randomness
          array[i] = Math.floor((timestamp + rand + i * 137 + (i * i * 31)) % 256);
        }
        return array;
      }
    },
    subtle: {} as any, // Placeholder for subtle crypto API
    // Add web property for @noble/hashes compatibility
    web: {
      getRandomValues: (array: any) => {
        // Use the same implementation as above
        return global.crypto.getRandomValues(array);
      }
    }
  } as any;
  
  console.log('Crypto polyfill set up successfully');
}

// Buffer polyfill
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Process polyfill
if (typeof global.process === 'undefined') {
  global.process = process;
}

