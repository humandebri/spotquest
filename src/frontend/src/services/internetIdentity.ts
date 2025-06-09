import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { IIAuthConfig, SecureAuthData } from '../types/auth';
import { secureAuthStorage } from './secureStorage';

const DEFAULT_IDENTITY_PROVIDER = 'https://identity.ic0.app';
const DEFAULT_MAX_TIME_TO_LIVE = BigInt(30 * 24 * 60 * 60 * 1000 * 1000 * 1000); // 30 days in nanoseconds
const AUTH_STORAGE_KEY = 'ii_delegation';

export class InternetIdentityService {
  private authClient: AuthClient | null = null;
  private identity: Identity | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'web') {
        this.authClient = await AuthClient.create({
          idleOptions: {
            idleTimeout: 1000 * 60 * 60 * 24 * 30, // 30 days
            disableDefaultIdleCallback: true,
          },
        });
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Internet Identity service:', error);
      throw new Error('Internet Identity initialization failed');
    }
  }

  async login(config: IIAuthConfig = {}): Promise<{ success: boolean; identity?: Identity; error?: string }> {
    try {
      await this.initialize();

      if (Platform.OS === 'web') {
        return await this.loginWeb(config);
      } else {
        return await this.loginNative(config);
      }
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  private async loginWeb(config: IIAuthConfig): Promise<{ success: boolean; identity?: Identity; error?: string }> {
    if (!this.authClient) {
      throw new Error('AuthClient not initialized');
    }

    return new Promise((resolve) => {
      this.authClient!.login({
        identityProvider: config.identityProvider || DEFAULT_IDENTITY_PROVIDER,
        maxTimeToLive: config.maxTimeToLive || DEFAULT_MAX_TIME_TO_LIVE,
        derivationOrigin: config.derivationOrigin,
        windowOpenerFeatures: config.windowOpenerFeatures || 'toolbar=0,location=0,menubar=0,width=500,height=500,left=100,top=100',
        onSuccess: async () => {
          try {
            this.identity = this.authClient!.getIdentity();
            
            // Save delegation to secure storage
            const delegation = await this.authClient!.getIdentity();
            if (delegation) {
              const authData: SecureAuthData = {
                delegation: JSON.stringify(delegation),
                publicKey: delegation.getPrincipal().toString(),
                expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
                origin: window.location.origin,
              };
              await secureAuthStorage.save(AUTH_STORAGE_KEY, authData);
            }

            resolve({
              success: true,
              identity: this.identity
            });
          } catch (error) {
            console.error('Post-login processing failed:', error);
            resolve({
              success: false,
              error: 'Post-login processing failed'
            });
          }
        },
        onError: (error) => {
          console.error('Web login error:', error);
          resolve({
            success: false,
            error: error || 'Web authentication failed'
          });
        },
      });
    });
  }

  private async loginNative(config: IIAuthConfig): Promise<{ success: boolean; identity?: Identity; error?: string }> {
    try {
      // Create deep link URL for callback
      const redirectUrl = Linking.createURL('auth/callback');
      const identityProvider = config.identityProvider || DEFAULT_IDENTITY_PROVIDER;
      
      // Create the authentication URL with proper parameters
      const authUrl = new URL(identityProvider);
      authUrl.searchParams.set('redirect_uri', redirectUrl);
      authUrl.searchParams.set('client_id', 'guess-the-spot-mobile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid');
      
      console.log('Opening authentication URL:', authUrl.toString());
      console.log('Redirect URL:', redirectUrl);

      // Open the browser for authentication
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        redirectUrl,
        {
          showInRecents: false,
          createTask: false,
        }
      );

      console.log('Authentication result:', result);

      if (result.type === 'success' && result.url) {
        return await this.handleAuthCallback(result.url);
      } else if (result.type === 'cancel') {
        return {
          success: false,
          error: 'Authentication was cancelled'
        };
      } else {
        return {
          success: false,
          error: 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Native login error:', error);
      
      // Show development-friendly authentication
      if (__DEV__) {
        return await this.showDevAuthDialog();
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Native authentication failed'
      };
    }
  }

  private async handleAuthCallback(callbackUrl: string): Promise<{ success: boolean; identity?: Identity; error?: string }> {
    try {
      const url = new URL(callbackUrl);
      const authCode = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      if (!authCode) {
        throw new Error('No authorization code received');
      }

      // In a real implementation, you would exchange the code for tokens
      // For now, we'll simulate a successful authentication
      console.log('Received auth code:', authCode);
      console.log('State:', state);

      // Create a mock identity for development
      // In production, this would be derived from the actual II response
      const mockPrincipal = Principal.fromText('2vxsx-fae');
      
      // Save authentication data
      const authData: SecureAuthData = {
        delegation: authCode,
        publicKey: mockPrincipal.toString(),
        expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
        origin: 'mobile-app',
      };
      
      await secureAuthStorage.save(AUTH_STORAGE_KEY, authData);
      
      return {
        success: true,
        // Note: In production, you'd create a proper identity from the delegation
      };
    } catch (error) {
      console.error('Callback handling failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Callback processing failed'
      };
    }
  }

  private async showDevAuthDialog(): Promise<{ success: boolean; identity?: Identity; error?: string }> {
    return new Promise((resolve) => {
      Alert.alert(
        'Development Authentication',
        'Internet Identity mobile authentication is in development. Use test authentication?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({
              success: false,
              error: 'Authentication cancelled'
            })
          },
          {
            text: 'Test Login',
            onPress: async () => {
              try {
                const testPrincipal = Principal.fromText('2vxsx-fae');
                const authData: SecureAuthData = {
                  delegation: 'test_delegation',
                  publicKey: testPrincipal.toString(),
                  expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
                  origin: 'dev-mobile',
                };
                
                await secureAuthStorage.save(AUTH_STORAGE_KEY, authData);
                
                resolve({
                  success: true,
                });
              } catch (error) {
                resolve({
                  success: false,
                  error: 'Test authentication failed'
                });
              }
            }
          }
        ]
      );
    });
  }

  async logout(): Promise<void> {
    try {
      if (Platform.OS === 'web' && this.authClient) {
        await this.authClient.logout();
      }
      
      // Clear stored authentication data
      await secureAuthStorage.remove(AUTH_STORAGE_KEY);
      
      this.identity = null;
    } catch (error) {
      console.error('Logout failed:', error);
      throw new Error('Logout failed');
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // Check stored authentication data
      const authData = await secureAuthStorage.load(AUTH_STORAGE_KEY);
      if (authData && authData.expiry > Date.now()) {
        return true;
      }

      // Check web AuthClient if available
      if (Platform.OS === 'web' && this.authClient) {
        const isAuth = await this.authClient.isAuthenticated();
        if (isAuth) {
          this.identity = this.authClient.getIdentity();
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }

  async getPrincipal(): Promise<Principal | null> {
    try {
      // Try to get from current identity
      if (this.identity) {
        return this.identity.getPrincipal();
      }

      // Try to get from stored data
      const authData = await secureAuthStorage.load(AUTH_STORAGE_KEY);
      if (authData && authData.publicKey) {
        return Principal.fromText(authData.publicKey);
      }

      // Try to get from web AuthClient
      if (Platform.OS === 'web' && this.authClient) {
        this.identity = this.authClient.getIdentity();
        return this.identity.getPrincipal();
      }

      return null;
    } catch (error) {
      console.error('Failed to get principal:', error);
      return null;
    }
  }

  async getIdentity(): Promise<Identity | null> {
    try {
      if (this.identity) {
        return this.identity;
      }

      if (Platform.OS === 'web' && this.authClient) {
        const isAuth = await this.authClient.isAuthenticated();
        if (isAuth) {
          this.identity = this.authClient.getIdentity();
          return this.identity;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get identity:', error);
      return null;
    }
  }
}

export const internetIdentityService = new InternetIdentityService();