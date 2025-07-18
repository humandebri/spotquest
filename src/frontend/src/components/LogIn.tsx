import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useIIIntegrationContext } from 'expo-ii-integration';

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
      // Get current route for redirect after login
      const currentRoute = route.name;
      
      await login({
        redirectPath: currentRoute,
      });
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
        <Text style={styles.buttonText}>Login with Internet Identity</Text>
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