import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getSecureStorage } from '../storage';

const IDENTITY_PROVIDER = 'https://identity.ic0.app';
const AUTH_PATH = '/authenticate';

export class DirectAuthService {
  private authClient: AuthClient | null = null;
  private storage = getSecureStorage();

  async init(): Promise<void> {
    try {
      this.authClient = await AuthClient.create({
        idleOptions: {
          idleTimeout: 1000 * 60 * 60 * 24 * 30, // 30 days
          disableIdle: true,
        },
        storage: {
          get: async (key: string) => {
            const value = await this.storage.getItem(key);
            return value || null;
          },
          set: async (key: string, value: string) => {
            await this.storage.setItem(key, value);
          },
          remove: async (key: string) => {
            await this.storage.removeItem(key);
          },
        },
      });
    } catch (error) {
      console.error('Failed to initialize auth client:', error);
      throw error;
    }
  }

  async login(): Promise<void> {
    if (!this.authClient) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.authClient) {
        reject(new Error('Auth client not initialized'));
        return;
      }

      const isWeb = Platform.OS === 'web';
      
      if (isWeb) {
        // Web authentication
        this.authClient.login({
          identityProvider: IDENTITY_PROVIDER,
          onSuccess: () => resolve(),
          onError: (error) => reject(error),
          windowOpenerFeatures: `
            left=${window.screen.width / 2 - 525 / 2},
            top=${window.screen.height / 2 - 705 / 2},
            toolbar=0,location=0,menubar=0,width=525,height=705
          `,
        });
      } else {
        // Mobile authentication with WebBrowser
        this.mobileLogin()
          .then(() => resolve())
          .catch((error) => reject(error));
      }
    });
  }

  private async mobileLogin(): Promise<void> {
    if (!this.authClient) {
      throw new Error('Auth client not initialized');
    }

    // Generate a session ID
    const sessionId = Math.random().toString(36).substring(7);
    
    // Store session temporarily
    await this.storage.setItem('auth_session_id', sessionId);
    
    // Create callback URL
    const redirectUrl = Linking.createURL('auth');
    
    // Build authentication URL
    const authUrl = `${IDENTITY_PROVIDER}${AUTH_PATH}?` +
      `sessionPublicKey=${encodeURIComponent(sessionId)}` +
      `&callback=${encodeURIComponent(redirectUrl)}`;
    
    // Open browser
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    
    if (result.type === 'success' && result.url) {
      // Parse the callback URL
      const url = new URL(result.url);
      const delegation = url.searchParams.get('delegation');
      
      if (delegation) {
        // Store delegation
        await this.storage.setItem('delegation', delegation);
        
        // Mark as authenticated
        await this.storage.setItem('authenticated', 'true');
      } else {
        throw new Error('No delegation received');
      }
    } else if (result.type === 'cancel') {
      throw new Error('Authentication cancelled');
    } else {
      throw new Error('Authentication failed');
    }
  }

  async logout(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout();
    }
    
    // Clear storage
    await this.storage.removeItem('delegation');
    await this.storage.removeItem('authenticated');
    await this.storage.removeItem('auth_session_id');
  }

  async isAuthenticated(): Promise<boolean> {
    if (Platform.OS === 'web' && this.authClient) {
      return await this.authClient.isAuthenticated();
    }
    
    // For mobile, check storage
    const authenticated = await this.storage.getItem('authenticated');
    return authenticated === 'true';
  }

  async getIdentity(): Promise<Identity | null> {
    if (!this.authClient) {
      await this.init();
    }
    
    if (Platform.OS === 'web' && this.authClient) {
      return this.authClient.getIdentity();
    }
    
    // For mobile, we need to reconstruct identity from delegation
    // This is a simplified version - full implementation would need proper delegation handling
    return null;
  }

  async getPrincipal(): Promise<Principal | null> {
    const identity = await this.getIdentity();
    return identity ? identity.getPrincipal() : null;
  }
}

export const directAuthService = new DirectAuthService();