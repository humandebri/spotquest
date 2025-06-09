import React, { useState, useEffect } from 'react';
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
import { useIIIntegrationContext } from 'expo-ii-integration';
import { useIIAuthStore } from '../store/iiAuthStore';
import { Principal } from '@dfinity/principal';

export default function LoginScreenII() {
  const { 
    login, 
    logout, 
    isAuthenticated, 
    isAuthReady, 
    getIdentity, 
    authError, 
    clearAuthError 
  } = useIIIntegrationContext();
  
  const { 
    setAuthenticated, 
    setUnauthenticated, 
    setLoading, 
    setError,
    error: storeError 
  } = useIIAuthStore();
  
  const [isConnecting, setIsConnecting] = useState(false);

  // Sync authentication state with store
  useEffect(() => {
    const syncAuthState = async () => {
      if (isAuthenticated) {
        try {
          const identity = await getIdentity();
          if (identity) {
            const principal = identity.getPrincipal();
            setAuthenticated(principal, identity);
          }
        } catch (error) {
          console.error('Failed to get identity:', error);
          setError('Failed to retrieve identity');
        }
      } else {
        setUnauthenticated();
      }
    };

    if (isAuthReady) {
      syncAuthState();
    }
  }, [isAuthenticated, isAuthReady]);

  // Handle auth errors
  useEffect(() => {
    if (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed';
      setError(errorMessage);
      
      // Show alert for auth errors
      Alert.alert(
        'Authentication Error',
        errorMessage,
        [{ text: 'OK', onPress: clearAuthError }]
      );
    }
  }, [authError]);

  const handleLogin = async () => {
    setIsConnecting(true);
    setLoading(true);
    
    try {
      await login({
        // Additional login parameters if needed
        windowOpenerFeatures: Platform.OS === 'web' 
          ? 'toolbar=0,location=0,menubar=0,width=500,height=600,left=100,top=100' 
          : undefined,
      });
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      
      Alert.alert(
        'Login Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUnauthenticated();
    } catch (err) {
      console.error('Logout error:', err);
      Alert.alert(
        'Logout Failed',
        'Failed to logout. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Show loading screen while auth is initializing
  if (!isAuthReady) {
    return (
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Initializing authentication...</Text>
        </View>
      </LinearGradient>
    );
  }

  const displayError = authError ? 
    (authError instanceof Error ? authError.message : 'Authentication error') : 
    storeError;

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

            {displayError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, isConnecting && styles.loginButtonDisabled]}
              onPress={isAuthenticated ? handleLogout : handleLogin}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialCommunityIcons 
                    name={isAuthenticated ? "logout" : "shield-account"} 
                    size={24} 
                    color="#ffffff" 
                  />
                  <Text style={styles.loginButtonText}>
                    {isAuthenticated ? 'Logout' : 'Connect with Internet Identity'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS !== 'web' && !isAuthenticated && (
              <View style={styles.mobileInfo}>
                <Feather name="info" size={16} color="#94a3b8" />
                <Text style={styles.mobileInfoText}>
                  Mobile authentication will open a browser window
                </Text>
              </View>
            )}

            {__DEV__ && (
              <View style={styles.devInfo}>
                <Text style={styles.devInfoText}>
                  Development Mode - Using {Platform.OS} platform
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
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
  devInfo: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  devInfoText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});