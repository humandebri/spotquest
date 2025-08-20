import { Platform } from 'react-native';
import {
  WebSecureStorage,
  WebRegularStorage,
} from 'expo-storage-universal-web';
import {
  NativeSecureStorage,
  NativeRegularStorage,
} from 'expo-storage-universal-native';

export const secureStorage =
  Platform.OS === 'web' ? new WebSecureStorage() : new NativeSecureStorage();

export const regularStorage =
  Platform.OS === 'web' ? new WebRegularStorage() : new NativeRegularStorage();

// Legacy exports for backward compatibility
export { WebSecureStorage, NativeSecureStorage, WebRegularStorage, NativeRegularStorage };

// Legacy factory functions for backward compatibility
export function getSecureStorage() {
  return secureStorage;
}

export function getRegularStorage() {
  return regularStorage;
}