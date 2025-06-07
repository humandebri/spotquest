// Polyfills for @dfinity/agent in React Native
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import process from 'process';
import 'react-native-url-polyfill/auto';

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
  // For React Native, we'll use expo-crypto
  // This is a placeholder - actual crypto operations should use expo-crypto directly
  global.crypto = {
    getRandomValues: (array: any) => {
      // This is a basic implementation for development
      // In production, use expo-crypto's randomBytes
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {} as any, // Placeholder for subtle crypto API
    // Add web property for @noble/hashes compatibility
    web: {
      getRandomValues: (array: any) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      }
    }
  } as any;
}

// Buffer polyfill
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Process polyfill
if (typeof global.process === 'undefined') {
  global.process = process;
}