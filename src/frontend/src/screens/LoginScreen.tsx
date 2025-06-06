import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const { login, isLoading, error } = useAuthStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleLogin = async () => {
    setIsConnecting(true);
    try {
      await login();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>📍</Text>
          <Text style={styles.logoText}>Guess the Spot</Text>
          <Text style={styles.tagline}>写真から場所を当てるWeb3ゲーム</Text>
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            Connect your Internet Identity to start playing
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
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
                <Text style={styles.loginButtonText}>🔐 Connect with Internet Identity</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS !== 'web' && (
            <Text style={styles.mobileNote}>
              Note: Internet Identity login is currently only supported on web.
              Mobile authentication coming soon!
            </Text>
          )}

          {__DEV__ && (
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleLogin}
            >
              <Text style={styles.devButtonText}>🛠️ Dev Mode: Skip Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📷</Text>
            <Text style={styles.featureText}>Upload photos with GPS data</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎮</Text>
            <Text style={styles.featureText}>Guess locations & earn rewards</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🏆</Text>
            <Text style={styles.featureText}>Compete on the leaderboard</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  logoIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3282b8',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#94a3b8',
  },
  loginSection: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorContainer: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#3282b8',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mobileNote: {
    marginTop: 15,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  devButton: {
    marginTop: 20,
    padding: 10,
  },
  devButtonText: {
    color: '#fbbf24',
    fontSize: 14,
  },
  features: {
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  featureText: {
    fontSize: 16,
    color: '#cbd5e1',
  },
});