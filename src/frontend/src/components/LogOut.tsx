import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useIIIntegrationContext } from 'expo-ii-integration';

export function LogOut() {
  const { logout } = useIIIntegrationContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(
        'Logout Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleLogout}
      disabled={isLoading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#3282b8" />
      ) : (
        <Text style={styles.buttonText}>Logout</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#3282b8',
    fontSize: 16,
    fontWeight: '500',
  },
});