// Polyfills for @dfinity/agent in React Native
import { Platform } from 'react-native';

// TextEncoder/TextDecoder polyfill
if (typeof global.TextEncoder === 'undefined') {
  const TextEncodingPolyfill = require('text-encoding');
  global.TextEncoder = TextEncodingPolyfill.TextEncoder;
  global.TextDecoder = TextEncodingPolyfill.TextDecoder;
}

// Crypto polyfill for React Native
if (typeof global.crypto === 'undefined') {
  // For React Native, we'll use expo-crypto
  // This is a placeholder - actual crypto operations should use expo-crypto directly
  global.crypto = {
    getRandomValues: (array) => {
      // This is a basic implementation for development
      // In production, use expo-crypto's randomBytes
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    subtle: {} // Placeholder for subtle crypto API
  };
}

// Buffer polyfill
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// Process polyfill
if (typeof global.process === 'undefined') {
  global.process = require('process');
}

// URL polyfill for React Native
if (Platform.OS !== 'web' && typeof global.URL === 'undefined') {
  require('react-native-url-polyfill/auto');
}

export {};