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
import { useIIIntegrationContext } from 'expo-ii-integration';
import { LogIn } from '../../components/LogIn';
import { useDevAuth } from '../../contexts/DevAuthContext';
import { DEBUG_CONFIG, debugLog, debugError } from '../../utils/debugConfig';

export default function LoginScreen() {
  const { isAuthenticated, authError } = useIIIntegrationContext();
  const { loginAsDev, isDevMode } = useDevAuth();
  const [isDevLogin, setIsDevLogin] = useState(false);

  // Monitor authentication state changes
  React.useEffect(() => {
    debugLog('AUTH_FLOW', '🔍 LoginScreen: isAuthenticated =', isAuthenticated);
    if (isAuthenticated) {
      debugLog('AUTH_FLOW', '✅ User authenticated successfully!');
    }
  }, [isAuthenticated]);

  // Monitor auth errors
  React.useEffect(() => {
    if (authError) {
      debugError('AUTH_FLOW', '❌ Auth error:', authError);
      Alert.alert('Authentication Error', String(authError), [{ text: 'OK' }]);
    }
  }, [authError]);

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
            
            {/* Internet Identity Login */}
            <View style={styles.loginOption}>
              <LogIn />
              <Text style={styles.optionDescription}>
                Secure login with Internet Identity
              </Text>
            </View>

            {/* Dev Mode Login */}
            {isDevMode && (
              <>
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
                      <Text style={styles.devButtonText}>Dev Mode Login</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
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