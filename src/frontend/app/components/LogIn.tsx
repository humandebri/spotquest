import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { secureStorage } from '../storage';
import { startExternalLogin } from '../utils/iiFallback';

/**
 * Component that handles the login functionality
 */
export function LogIn() {
  const { login } = useIIIntegrationContext();
  const [busy, setBusy] = useState(false);
  const route = useRoute();

  const handleLogin = async () => {
    setBusy(true);
    try {
      // Prefer external Safari-based flow for reliability on iOS
      const currentRoute = route.name;
      const iiCanisterId = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID || '';
      const getDLType = () => {
        const eas = process.env.EXPO_PUBLIC_EAS_DEEP_LINK_TYPE as any;
        if (eas === 'expo-go' || eas === 'dev-client' || eas === 'modern') return eas;
        const appOwnership = (Constants as any).appOwnership as ('expo' | 'guest' | 'standalone' | undefined);
        if (appOwnership === 'expo') return 'expo-go';
        if (appOwnership === 'guest') return 'dev-client';
        return 'modern';
      };
      await startExternalLogin(iiCanisterId, secureStorage as any, getDLType, { openURL: (u: string) => Linking.openURL(u).then(() => undefined) });
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, busy && styles.buttonDisabled]}
      onPress={handleLogin}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Text style={styles.buttonText}>Login with Internet Identity (Safari)</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#3282b8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
