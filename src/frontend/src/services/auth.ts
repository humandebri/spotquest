import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_SESSION_KEY = 'auth_session';
const MOCK_AUTH_KEY = 'mock_auth';

class AuthService {
  private authClient: AuthClient | null = null;

  async init() {
    if (Platform.OS === 'web') {
      // Web用のAuthClient初期化
      this.authClient = await AuthClient.create({
        idleOptions: {
          idleTimeout: 1000 * 60 * 60 * 24, // 24 hours
          disableDefaultIdleCallback: true,
        },
      });
    }
    
    // 開発環境でのモック認証
    if (__DEV__) {
      const mockAuth = await this.getSecureItem(MOCK_AUTH_KEY);
      if (mockAuth === 'true') {
        console.log('Using mock authentication for development');
      }
    }
  }

  async login(): Promise<Principal | null> {
    try {
      // 開発環境でのモック
      if (__DEV__) {
        const mockPrincipal = Principal.fromText('2vxsx-fae');
        await this.saveSession({
          provider: 'mock',
          principal: mockPrincipal.toString(),
          timestamp: Date.now(),
        });
        return mockPrincipal;
      }

      // 本番環境
      if (Platform.OS === 'web' && this.authClient) {
        return new Promise((resolve) => {
          this.authClient!.login({
            identityProvider: process.env.EXPO_PUBLIC_IDENTITY_PROVIDER,
            onSuccess: async () => {
              const identity = this.authClient!.getIdentity();
              const principal = identity.getPrincipal();
              
              await this.saveSession({
                provider: 'ii',
                principal: principal.toString(),
                timestamp: Date.now(),
              });
              
              resolve(principal);
            },
            onError: (error) => {
              console.error('Login error:', error);
              resolve(null);
            },
          });
        });
      } else {
        // モバイルでは現在Internet Identityは直接サポートされていない
        // 将来的にはWebViewやDeep Linkingで対応
        console.warn('Authentication not supported on mobile yet');
        return null;
      }
    } catch (error) {
      console.error('Login failed:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    if (Platform.OS === 'web' && this.authClient) {
      await this.authClient.logout();
    }
    await this.clearSession();
  }

  async isAuthenticated(): Promise<boolean> {
    // 開発環境チェック
    if (__DEV__) {
      const mockAuth = await this.getSecureItem(MOCK_AUTH_KEY);
      if (mockAuth === 'true') {
        return true;
      }
    }

    const session = await this.getSession();
    if (session) {
      // セッションの有効期限チェック（24時間）
      if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
        return true;
      }
    }

    if (Platform.OS === 'web' && this.authClient) {
      return await this.authClient.isAuthenticated();
    }

    return false;
  }

  async getPrincipal(): Promise<Principal | null> {
    const session = await this.getSession();
    if (session?.principal) {
      return Principal.fromText(session.principal);
    }

    if (Platform.OS === 'web' && this.authClient) {
      const identity = this.authClient.getIdentity();
      return identity.getPrincipal();
    }

    return null;
  }

  // セキュアストレージ用のヘルパーメソッド
  private async saveSession(session: any): Promise<void> {
    const sessionString = JSON.stringify(session);
    
    if (Platform.OS === 'web') {
      localStorage.setItem(AUTH_SESSION_KEY, sessionString);
    } else {
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, sessionString);
    }
  }

  private async getSession(): Promise<any> {
    try {
      let sessionString: string | null = null;
      
      if (Platform.OS === 'web') {
        sessionString = localStorage.getItem(AUTH_SESSION_KEY);
      } else {
        sessionString = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
      }
      
      return sessionString ? JSON.parse(sessionString) : null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  private async clearSession(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    }
  }

  private async getSecureItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  }

  // 開発環境用のモック認証設定
  async setMockAuth(enabled: boolean): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(MOCK_AUTH_KEY, enabled.toString());
    } else {
      await SecureStore.setItemAsync(MOCK_AUTH_KEY, enabled.toString());
    }
  }
}

export const authService = new AuthService();

// 初期化
authService.init().catch(console.error);