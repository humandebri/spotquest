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
// Removed II login UI
import { useDevAuth } from '../../contexts/DevAuthContext';
import { debugLog, debugError } from '../../utils/debugConfig';
import { secureStorage } from '../../storage';
import * as Linking from 'expo-linking';
// Removed II fallback helpers
import { signInWithGoogle } from '../../utils/googleAuth';
import { getOrCreateSessionIdentity } from '../../utils/sessionKeys';
import { useIIAuthStore } from '../../store/iiAuthStore';
import { Principal } from '@dfinity/principal';
import { LogIn as IIAuthButton } from '../../components/LogIn';

export default function LoginScreen() {
  const { loginAsDev, isDevMode } = useDevAuth();
  const [isDevLogin, setIsDevLogin] = useState(false);
  const isPublicBuild = process.env.EXPO_PUBLIC_PUBLIC_BUILD === 'true' && !__DEV__;
  // II auth state handling removed from this screen

  const handleDevLogin = async () => {
    setIsDevLogin(true);
    try {
      debugLog('AUTH_FLOW', '🔧 Starting dev login...');
      await loginAsDev();
      debugLog('AUTH_FLOW', '🔧 Dev login successful!');
      
      Alert.alert(
        'Dev Mode',
        'Login successful!\n\nNote: This is a FREE game (no tokens required to play).',
        [{ text: 'OK' }]
      );
    } catch (error) {
      debugError('AUTH_FLOW', '🔧 Dev login error:', error);
      Alert.alert('Dev Login Error', 'Failed to login with dev credentials');
    } finally {
      setIsDevLogin(false);
    }
  };

  // Oisy Wallet login via external Safari
  const handleOisyLogin = async () => {
    try {
      debugLog('AUTH_FLOW', '🧭 Oisy login starting...');
      const returnUrl = Linking.createURL('wallet-connect'); // spotquest:///wallet-connect
      await (await import('../../utils/oisy')).openOisyConnect({
        returnUrl,
        appName: 'SpotQuest',
        includePubkey: true,
        storage: secureStorage as any,
      });
    } catch (e: any) {
      debugError('AUTH_FLOW', '🧭 Oisy login error:', e);
      Alert.alert('Oisy Login Error', e?.message ?? 'Unknown error');
    }
  };

  // Google login (via AuthSession) then link to local Ed25519 identity
  const handleGoogleLogin = async () => {
    try {
      debugLog('AUTH_FLOW', '🧭 Google login starting...');
      const res = await signInWithGoogle();
      if (!res || !res.idToken) {
        Alert.alert('Google Login', 'Cancelled or no id_token');
        return;
      }
      const identity = await getOrCreateSessionIdentity(secureStorage as any);
      const principal = identity.getPrincipal();
      useIIAuthStore.getState().setAuthenticated(principal as unknown as Principal, identity as any);
      debugLog('AUTH_FLOW', '✅ Google login linked to SpotQuest identity:', principal.toString());
      Alert.alert('Login', 'Signed in with Google and created SpotQuest identity');
    } catch (e: any) {
      debugError('AUTH_FLOW', '🧭 Google login error:', e);
      Alert.alert('Google Login Error', e?.message ?? 'Unknown error');
    }
  };

  // Removed raw Safari debug handler

  return (
    <LinearGradient
      colors={['#1a1a2e', '#0f4c75', '#3282b8']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo/Title Section */}
          <View style={styles.logoSection}>
            <MaterialCommunityIcons name="map-marker-radius" size={80} color="#bbe1fa" />
            <Text style={styles.title}>SpotQuest</Text>
            <Text style={styles.subtitle}>Explore the World, One Photo at a Time</Text>
          </View>

          {/* Login Section */}
          <View style={styles.loginSection}>
            <Text style={styles.sectionTitle}>Get Started</Text>
            {isPublicBuild ? (
              // Public build: show only Google login
              <TouchableOpacity style={styles.helperButton} onPress={handleGoogleLogin}>
                <Text style={styles.helperText}>Sign in with Google</Text>
              </TouchableOpacity>
            ) : (
              // Internal/dev build: show full options
              <>
                {/* Internet Identity login via expo-icp flow */}
                <IIAuthButton />
                <View style={{ height: 8 }} />
                {/* Oisy Wallet login */}
                <TouchableOpacity style={styles.helperButton} onPress={handleOisyLogin}>
                  <Text style={styles.helperText}>Login with Oisy Wallet (Safari)</Text>
                </TouchableOpacity>
                <View style={{ height: 8 }} />
                <TouchableOpacity style={styles.helperButton} onPress={handleGoogleLogin}>
                  <Text style={styles.helperText}>Sign in with Google</Text>
                </TouchableOpacity>
                <View style={{ height: 12 }} />
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={handleDevLogin}
                  disabled={isDevLogin}
                >
                  {isDevLogin ? (
                    <ActivityIndicator size="small" color="#bbe1fa" />
                  ) : (
                    <>
                      <Feather name="code" size={20} color="#bbe1fa" />
                      <Text style={styles.devButtonText}>Dev Mode Login (Expo Go)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
            {/* II troubleshooting buttons removed */}
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              🌍 Guess photo locations from around the world
            </Text>
            <Text style={styles.infoText}>
              🏆 Earn SPOT tokens for accurate guesses
            </Text>
            <Text style={styles.infoText}>
              📸 Upload your own photos to challenge others
            </Text>
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
    padding: 20,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#bbe1fa',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#bbe1fa',
    opacity: 0.8,
    marginTop: 8,
    textAlign: 'center',
  },
  loginSection: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#bbe1fa',
    marginBottom: 24,
    textAlign: 'center',
  },
  loginOption: {
    alignItems: 'center',
  },
  optionDescription: {
    fontSize: 14,
    color: '#bbe1fa',
    opacity: 0.7,
    marginTop: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#bbe1fa',
    opacity: 0.3,
  },
  dividerText: {
    fontSize: 14,
    color: '#bbe1fa',
    opacity: 0.5,
    marginHorizontal: 16,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbe1fa',
    opacity: 0.8,
  },
  devButtonText: {
    fontSize: 16,
    color: '#bbe1fa',
    marginLeft: 8,
  },
  helperButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbe1fa',
    opacity: 0.7,
  },
  helperText: {
    fontSize: 14,
    color: '#bbe1fa',
  },
  infoSection: {
    marginTop: 40,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#bbe1fa',
    opacity: 0.9,
    marginBottom: 12,
    textAlign: 'center',
  },
});
