import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = async () => {
    setIsConnecting(true);
    if (clearError) clearError(); // Clear any previous errors
    
    try {
      await login();
      // Login success will be handled by the auth context and navigation will happen automatically
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert(
        'Authentication Error',
        err instanceof Error ? err.message : 'Login failed. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b', '#0f172a']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="map-marker-question" size={60} color="#3b82f6" />
            </View>
            <Text style={styles.title}>Guess the Spot</Text>
            <Text style={styles.subtitle}>
              写真から場所を当てる次世代Web3ゲーム
            </Text>
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.instructionText}>
              Connect your Internet Identity to continue your journey
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {typeof error === 'string' ? error : error.message || 'Authentication failed'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, isConnecting && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isConnecting || isLoading}
            >
              {isConnecting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-account" size={24} color="#ffffff" />
                  <Text style={styles.loginButtonText}>
                    Connect with Internet Identity
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS !== 'web' && (
              <View style={styles.mobileInfo}>
                <Feather name="info" size={16} color="#94a3b8" />
                <Text style={styles.mobileInfoText}>
                  Mobile authentication will open a browser window
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 64,
  },
  logoContainer: {
    width: 128,
    height: 128,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#64748b',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  mobileInfo: {
    marginTop: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mobileInfoText: {
    color: '#94a3b8',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});