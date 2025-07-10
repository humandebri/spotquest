import React, { useState, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { gameService } from '../services/game';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { debugLog } from '../utils/debugConfig';
import { bytesToHex } from '../utils/bytesToHex';

export function LogIn() {
  const { login: originalLogin } = useIIIntegrationContext();
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const deepLinkSub = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentRouteRef = useRef<string | undefined>(undefined);
  const sessionKeyRef = useRef<Ed25519KeyIdentity | null>(null);
  const timeoutIdRef = useRef<any>(null);

  const handleLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Store the current route to return after login
      const currentRoute = navigation.getState()?.routes[navigation.getState()?.index ?? 0]?.name;
      currentRouteRef.current = currentRoute;
      
      // Use custom WebBrowser flow
      debugLog('AUTH_FLOW', '🔐 Starting custom WebBrowser flow...');
      
      // Generate a new Ed25519 key for this session
      const sessionKey = Ed25519KeyIdentity.generate();
      sessionKeyRef.current = sessionKey;
      // Convert DER to hex string
      const publicKey = bytesToHex(sessionKey.getPublicKey().toDer() as ArrayBuffer);
      
      // II に渡す正式な redirect_uri（HTTPS）
      const redirectUri = 'https://77fv5-oiaaa-aaaal-qsoea-cai.icp0.io/ii-callback.html';
      
      // ASWebAuthenticationSession が監視する returnUrl（カスタムスキーム）
      // ⇒ HTML ブリッジが最終的に location.replace する URL
      const returnUrl = Linking.createURL('callback'); // spotquest://callback
      
      debugLog('AUTH_FLOW', '🔐 Generated public key:', publicKey);
      debugLog('AUTH_FLOW', '🔐 Redirect URI (for II):', redirectUri);
      debugLog('AUTH_FLOW', '🔐 Return URL (for ASWebAuthenticationSession):', returnUrl);
      
      // Initialize game service with a temporary identity if needed
      if (!gameService.isInitialized) {
        debugLog('AUTH_FLOW', '🔐 Initializing game service with temp identity...');
        // Use a temporary Ed25519 identity for the initial API call
        const tempIdentity = Ed25519KeyIdentity.generate();
        await gameService.init(tempIdentity);
      }
      
      // Create II session
      debugLog('AUTH_FLOW', '🔐 Creating II session...');
      const { sessionId, authorizeUrl } = await gameService.newSession(publicKey, redirectUri);
      debugLog('AUTH_FLOW', '🔐 Got authorize URL:', authorizeUrl);
      
      // Store session ID for deep link handler
      sessionIdRef.current = sessionId;
      
      // Set up deep link listener
      deepLinkSub.current = Linking.addEventListener('url', async ({ url }) => {
        debugLog('DEEP_LINKS', '🔗 DeepLink received in LogIn:', url);
        
        // Check if this is our callback
        if (url.includes('spotquest://callback')) {
          debugLog('DEEP_LINKS', '🔗 Auth callback detected!');
          
          // Parse the URL
          try {
            // Split URL to get the fragment part after #
            const urlParts = url.split('#');
            const hash = urlParts[1] ?? '';
            
            debugLog('DEEP_LINKS', '🔗 Raw URL:', url);
            debugLog('DEEP_LINKS', '🔗 Raw fragment:', hash);
            
            // Also parse using Linking for fallback
            const parsed = Linking.parse(url);
            const fragment = parsed.path || '';
            const queryParams = parsed.queryParams;
            debugLog('DEEP_LINKS', '🔗 Linking.parse fragment:', fragment);
            debugLog('DEEP_LINKS', '🔗 Linking.parse query params:', queryParams);
            
            // Use the raw hash if available, otherwise fall back to Linking.parse
            const fragmentToParse = hash || fragment || '';
            
            // Handle success/error
            if (fragmentToParse && (fragmentToParse.includes('access_token') || fragmentToParse.includes('delegation'))) {
              debugLog('DEEP_LINKS', '✅ Authentication successful!');
              
              // Parse delegation data from fragment
              const fragmentParams = new URLSearchParams(fragmentToParse);
              
              // Log all parameters for debugging
              debugLog('AUTH_FLOW', '🔐 All fragment params:', [...fragmentParams]);
              
              // Try different possible parameter names
              const rawDelegation = fragmentParams.get('delegation');
              const accessToken = fragmentParams.get('access_token');
              const identityToken = fragmentParams.get('identity_token');
              
              debugLog('AUTH_FLOW', '🔐 Raw delegation:', rawDelegation);
              debugLog('AUTH_FLOW', '🔐 Access token:', accessToken);
              debugLog('AUTH_FLOW', '🔐 Identity token:', identityToken);
              
              let delegation = null;
              let userPublicKey = sessionKeyRef.current ? bytesToHex(sessionKeyRef.current.getPublicKey().toDer() as ArrayBuffer) : '';
              let delegationPubkey = sessionKeyRef.current ? bytesToHex(sessionKeyRef.current.getPublicKey().toDer() as ArrayBuffer) : '';
              
              // Try to parse delegation if it's URL encoded JSON
              if (rawDelegation) {
                try {
                  const decodedDelegation = decodeURIComponent(rawDelegation);
                  debugLog('AUTH_FLOW', '🔐 Decoded delegation:', decodedDelegation);
                  
                  const delegationJson = JSON.parse(decodedDelegation);
                  debugLog('AUTH_FLOW', '🔐 Parsed delegation JSON:', delegationJson);
                  
                  // Extract actual fields from delegation JSON
                  delegation = JSON.stringify(delegationJson);
                  
                  // Log all fields for debugging
                  debugLog('AUTH_FLOW', '🔐 Delegation fields:', Object.keys(delegationJson));
                  
                  // Try different possible field names
                  if (delegationJson.pubkey) {
                    userPublicKey = delegationJson.pubkey;
                  } else if (delegationJson.publicKey) {
                    userPublicKey = delegationJson.publicKey;
                  } else if (delegationJson.public_key) {
                    userPublicKey = delegationJson.public_key;
                  }
                  
                  if (delegationJson.targets && delegationJson.targets[0]) {
                    delegationPubkey = delegationJson.targets[0];
                  } else if (delegationJson.delegation_pubkey) {
                    delegationPubkey = delegationJson.delegation_pubkey;
                  } else if (delegationJson.delegationPubkey) {
                    delegationPubkey = delegationJson.delegationPubkey;
                  }
                  
                  // Log what we extracted
                  debugLog('AUTH_FLOW', '🔐 Extracted userPublicKey:', userPublicKey);
                  debugLog('AUTH_FLOW', '🔐 Extracted delegationPubkey:', delegationPubkey);
                } catch (parseError) {
                  debugLog('AUTH_FLOW', '⚠️ Could not parse delegation JSON, using raw value:', parseError);
                  delegation = rawDelegation;
                }
              } else if (accessToken) {
                // Fallback to access_token if no delegation parameter
                delegation = accessToken;
              }
              
              if (delegation && userPublicKey && delegationPubkey) {
                debugLog('AUTH_FLOW', '🔐 Got delegation data, saving...');
                
                try {
                  // Save delegation to backend
                  if (sessionIdRef.current) {
                    await gameService.saveDelegate(sessionIdRef.current, delegation, userPublicKey, delegationPubkey);
                    debugLog('AUTH_FLOW', '✅ Delegation saved successfully');
                    
                    // Close the session to finalize authentication
                    await gameService.closeSession(sessionIdRef.current);
                    debugLog('AUTH_FLOW', '✅ Session closed successfully');
                    
                    // Now use the original expo-ii-integration login to complete the flow
                    // This will handle the identity creation and storage
                    await originalLogin({ redirectPath: currentRouteRef.current });
                    
                    // Success - loading will be set to false
                    setIsLoading(false);
                    
                    // Clear timeout
                    if (timeoutIdRef.current) {
                      clearTimeout(timeoutIdRef.current);
                      timeoutIdRef.current = null;
                    }
                  } else {
                    debugLog('AUTH_FLOW', '❌ No session ID available');
                    Alert.alert('Authentication Failed', 'Session ID not found');
                    setIsLoading(false);
                    
                    // Clear timeout
                    if (timeoutIdRef.current) {
                      clearTimeout(timeoutIdRef.current);
                      timeoutIdRef.current = null;
                    }
                  }
                  
                } catch (delegateError) {
                  debugLog('AUTH_FLOW', '❌ Error saving delegation:', delegateError);
                  Alert.alert('Authentication Failed', 'Could not save authentication data');
                  setIsLoading(false);
                  
                  // Clear timeout
                  if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                    timeoutIdRef.current = null;
                  }
                }
              }
              
              // Clean up listener
              if (deepLinkSub.current) {
                deepLinkSub.current.remove();
                deepLinkSub.current = null;
              }
            } else {
              // Check for error in query params or fragment
              const errorInQuery = queryParams?.error;
              const errorInFragment = fragmentToParse && new URLSearchParams(fragmentToParse).get('error');
              const error = errorInQuery || errorInFragment;
              
              if (error) {
                debugLog('DEEP_LINKS', '❌ Authentication error:', error);
                Alert.alert('Authentication Failed', `Error: ${error}`);
              } else {
                debugLog('DEEP_LINKS', '⚠️ No authentication data found in URL');
                Alert.alert('Authentication Failed', 'No authentication data received');
              }
              
              setIsLoading(false);
              
              // Clear timeout
              if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
                timeoutIdRef.current = null;
              }
            }
          } catch (e) {
            debugLog('DEEP_LINKS', '❌ Error parsing URL:', e);
            Alert.alert('Authentication Failed', 'Error processing authentication response');
            setIsLoading(false);
            
            // Clear timeout
            if (timeoutIdRef.current) {
              clearTimeout(timeoutIdRef.current);
              timeoutIdRef.current = null;
            }
          }
        }
      });
      
      // Set up timeout handler (30 seconds)
      debugLog('AUTH_FLOW', '⏱️ Setting up 30s timeout...');
      timeoutIdRef.current = setTimeout(() => {
        if (isLoading) {
          debugLog('AUTH_FLOW', '⏱️ Authentication timeout after 30s');
          Alert.alert('Authentication Timeout', 'Please try again');
          setIsLoading(false);
          
          // Clean up deep link listener
          if (deepLinkSub.current) {
            deepLinkSub.current.remove();
            deepLinkSub.current = null;
          }
        }
      }, 30000); // 30 seconds
      
      // Open II in WebBrowser with returnUrl (custom scheme)
      debugLog('AUTH_FLOW', '🔐 Opening WebBrowser with returnUrl...');
      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
      debugLog('AUTH_FLOW', '🔐 WebBrowser result:', result);
      
      // iOS 17+ returns null, so we rely on deep link
      if (result.type === 'cancel') {
        debugLog('AUTH_FLOW', '❌ User cancelled authentication');
        
        // Clear timeout
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
        
        throw new Error('Authentication cancelled');
      }
      
      // For older iOS versions, check the returned URL
      if (result.type === 'success' && result.url) {
        debugLog('AUTH_FLOW', '✅ Got URL from WebBrowser:', result.url);
      }
      
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      // Clean up deep link listener if still active
      if (deepLinkSub.current) {
        deepLinkSub.current.remove();
        deepLinkSub.current = null;
      }
      // Clear timeout if still active
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isLoading && styles.buttonDisabled]}
      onPress={handleLogin}
      disabled={isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLoading }}
    >
      {isLoading ? (
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