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
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../hooks/useAuth';
import { getSecureStorage, getRegularStorage } from '../../storage';
import { clearAllIIData } from '../../utils/clearAllIIData';
import { AuthPoller } from '../../utils/authPoller';
import { checkAndFixDelegation, createMockDelegation } from '../../utils/delegationFix';
import { useDevAuth } from '../../contexts/DevAuthContext';
import { DEBUG_CONFIG, debugLog, debugError } from '../../utils/debugConfig';
import { gameService } from '../../services/game';
import { Principal } from '@dfinity/principal';
import { useIIAuthStore } from '../../store/iiAuthStore';

export default function LoginScreen() {
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();
  const { loginAsDev, isDevMode } = useDevAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDevLogin, setIsDevLogin] = useState(false);
  const authPollerRef = React.useRef<AuthPoller | null>(null);
  
  // Monitor authentication state changes
  React.useEffect(() => {
    debugLog('AUTH_FLOW', '🔍 LoginScreen: isAuthenticated =', isAuthenticated);
    if (isAuthenticated) {
      debugLog('AUTH_FLOW', '✅ User authenticated successfully!');
      setIsConnecting(false);
      // Stop polling if running
      if (authPollerRef.current) {
        authPollerRef.current.stop();
        authPollerRef.current = null;
      }
    }
  }, [isAuthenticated]);
  
  // Cleanup poller on unmount
  React.useEffect(() => {
    return () => {
      if (authPollerRef.current) {
        authPollerRef.current.stop();
      }
    };
  }, []);

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

  const handleLogin = async () => {
    setIsConnecting(true);
    if (clearError) clearError(); // Clear any previous errors
    
    try {
      debugLog('AUTH_FLOW', '🔍 Starting login on physical device...');
      const result = await login();
      debugLog('AUTH_FLOW', '🔍 Login result:', result);
      
      // For physical devices, the browser will open
      if (Platform.OS !== 'web') {
        debugLog('AUTH_FLOW', '🔍 Browser opened for II authentication');
        debugLog('AUTH_FLOW', '🔍 Waiting for user to complete authentication in browser...');
        
        // Start auth polling with delegation fix
        const poller = new AuthPoller(
          async () => {
            // Check if delegation exists in storage
            const regularStorage = getRegularStorage();
            
            // First try to fix missing delegation
            const fixed = await checkAndFixDelegation(regularStorage);
            if (fixed) {
              debugLog('AUTH_FLOW', '✅ Delegation fixed!');
            }
            
            const delegation = regularStorage.getItem ? await regularStorage.getItem('expo-ii-integration.delegation') : null;
            return delegation !== null;
          },
          () => {
            debugLog('AUTH_FLOW', '✅ Authentication detected by poller!');
            // Force a re-render to check auth state
            setIsConnecting(false);
          }
        );
        
        authPollerRef.current = poller;
        poller.start();
      }
    } catch (err) {
      debugError('AUTH_FLOW', 'Login error:', err);
      Alert.alert(
        'Authentication Error',
        err instanceof Error ? err.message : 'Login failed. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Authentication',
      'This will clear all stored authentication data. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            try {
              const secureStorage = getSecureStorage();
              const regularStorage = getRegularStorage();
              await clearAllIIData(secureStorage, regularStorage);
              
              if (Platform.OS === 'web') {
                window.location.reload();
              } else {
                Alert.alert('Success', 'Authentication data has been reset.');
              }
            } catch (error) {
              debugError('AUTH_FLOW', 'Reset error:', error);
              Alert.alert('Error', 'Failed to reset authentication data.');
            } finally {
              setIsResetting(false);
            }
          },
        },
      ]
    );
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
            <Text style={styles.title}>SpotQuest</Text>
            <Text style={styles.subtitle}>
              写真から場所を当てる次世代Web3ゲーム
            </Text>
          </View>

          <View style={styles.loginSection}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.instructionText}>
              {isDevMode ? 
                'Development mode - for testing purposes only' :
                'Connect your Internet Identity to continue your journey'
              }
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {typeof error === 'string' ? error : (error as any)?.message || 'Authentication failed'}
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

            {/* Dev Login Button */}
            {__DEV__ && (
              <TouchableOpacity
                style={[styles.devLoginButton, isDevLogin && styles.loginButtonDisabled]}
                onPress={handleDevLogin}
                disabled={isDevLogin || isLoading}
              >
                {isDevLogin ? (
                  <ActivityIndicator color="#ff6b6b" />
                ) : (
                  <>
                    <Feather name="code" size={20} color="#ff6b6b" />
                    <Text style={styles.devLoginButtonText}>
                      Dev Login (Testing)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {Platform.OS !== 'web' && (
              <>
                <View style={styles.mobileInfo}>
                  <Feather name="info" size={16} color="#94a3b8" />
                  <Text style={styles.mobileInfoText}>
                    Mobile authentication will open a browser window
                  </Text>
                </View>
                
                {isConnecting && (
                  <TouchableOpacity
                    style={styles.returnButton}
                    onPress={async () => {
                      console.log('🔗 Manual return button pressed');
                      
                      // Stop poller
                      if (authPollerRef.current) {
                        authPollerRef.current.stop();
                        authPollerRef.current = null;
                      }
                      
                      // Try to close the browser
                      WebBrowser.coolDownAsync();
                      
                      // Check if delegation was stored
                      const regularStorage = getRegularStorage();
                      const delegation = regularStorage.getItem ? await regularStorage.getItem('expo-ii-integration.delegation') : null;
                      
                      if (delegation) {
                        console.log('✅ Delegation found! Authentication should be complete.');
                        // Force a page reload to re-initialize auth
                        if (Platform.OS === 'web') {
                          window.location.reload();
                        } else {
                          Alert.alert(
                            'Authentication Complete',
                            'Please restart the app to complete login.',
                            [{ text: 'OK' }]
                          );
                        }
                      } else {
                        console.log('❌ No delegation found yet.');
                        
                        // Try delegation fix
                        const fixed = await checkAndFixDelegation(regularStorage);
                        if (fixed) {
                          console.log('✅ Delegation fixed manually!');
                          Alert.alert(
                            'Authentication Complete',
                            'Please restart the app to complete login.',
                            [{ text: 'OK' }]
                          );
                        } else {
                          // Ask if user wants to use mock delegation for testing
                          Alert.alert(
                            'Authentication Issue',
                            'Could not retrieve authentication data. This is a known issue with Expo Go.',
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel'
                              },
                              {
                                text: 'Use Test Mode',
                                onPress: async () => {
                                  await createMockDelegation(regularStorage);
                                  Alert.alert('Test Mode', 'Please restart the app to use test authentication.');
                                }
                              }
                            ]
                          );
                        }
                      }
                      
                      setIsConnecting(false);
                    }}
                  >
                    <Feather name="arrow-left" size={16} color="#3b82f6" />
                    <Text style={styles.returnButtonText}>
                      Tap here after completing login in browser
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Debug reset button */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator color="#ef4444" size="small" />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={16} color="#ef4444" />
                    <Text style={styles.resetButtonText}>Reset Auth Data</Text>
                  </>
                )}
              </TouchableOpacity>
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
  resetButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetButtonText: {
    color: '#ef4444',
    fontSize: 14,
    marginLeft: 8,
  },
  returnButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  returnButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    marginLeft: 8,
  },
  devLoginButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderWidth: 2,
    borderColor: '#ff6b6b',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  devLoginButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});