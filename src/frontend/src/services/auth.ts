import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';
import * as SecureStore from 'expo-secure-store';
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const AUTH_SESSION_KEY = 'auth_session';
const IC_HOST = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';
const IDENTITY_PROVIDER = `https://identity.ic0.app`;

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
  }

  async login(): Promise<Principal | null> {
    try {
      if (Platform.OS === 'web' && this.authClient) {
        // Web版: 標準のInternet Identity認証
        return new Promise((resolve) => {
          this.authClient!.login({
            identityProvider: IDENTITY_PROVIDER,
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
        // モバイル版: WebBrowserを使用した認証
        const callbackUrl = Linking.createURL('auth/callback');
        const authUrl = `${IDENTITY_PROVIDER}?callback=${encodeURIComponent(callbackUrl)}`;
        
        // ブラウザで認証ページを開く
        const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
        
        if (result.type === 'success' && result.url) {
          // URLからprincipalを抽出（実際の実装では適切なパラメータ処理が必要）
          const url = new URL(result.url);
          const principalText = url.searchParams.get('principal');
          
          if (principalText) {
            const principal = Principal.fromText(principalText);
            
            await this.saveSession({
              provider: 'ii',
              principal: principal.toString(),
              timestamp: Date.now(),
            });
            
            return principal;
          }
        }
        
        // モバイルでの認証が未対応の場合の暫定措置
        console.warn('Mobile authentication is currently limited. Using temporary solution.');
        // 実際のアプリではここでユーザーに適切なメッセージを表示
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

  // Identity取得（管理サービス用）
  async getIdentity() {
    if (Platform.OS === 'web' && this.authClient) {
      return this.authClient.getIdentity();
    }
    return null;
  }
}

export const authService = new AuthService();

// 初期化
authService.init().catch(console.error);