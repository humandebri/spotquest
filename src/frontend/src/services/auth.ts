import { AuthClient } from '@dfinity/auth-client';
import { Principal } from '@dfinity/principal';
import * as SecureStore from 'expo-secure-store';
import { Platform, Linking, Alert } from 'react-native';
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
        // モバイル版での認証
        return await this.handleMobileAuth();
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

  // モバイル認証のハンドリング
  private async handleMobileAuth(): Promise<Principal | null> {
    try {
      // 開発環境では簡略化された認証フローを使用
      if (__DEV__) {
        return new Promise((resolve) => {
          Alert.alert(
            'Development Authentication',
            'This is a development environment. Use test authentication?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(null)
              },
              {
                text: 'Test Login',
                onPress: async () => {
                  const testPrincipal = Principal.fromText('2vxsx-fae');
                  await this.saveSession({
                    provider: 'ii',
                    principal: testPrincipal.toString(),
                    timestamp: Date.now(),
                  });
                  resolve(testPrincipal);
                }
              }
            ]
          );
        });
      }

      // 本番環境でのInternet Identity認証
      try {
        // Expo環境でのURL作成
        const callbackUrl = Linking.makeUrl('auth/callback');
        const authUrl = `${IDENTITY_PROVIDER}#authorize`;
        
        console.log('Opening auth URL:', authUrl);
        console.log('Callback URL:', callbackUrl);
        
        // ブラウザで認証ページを開く
        const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
        
        console.log('WebBrowser result:', result);
        
        if (result.type === 'success' && result.url) {
          // TODO: 実際のInternet Identityからの応答を処理
          // 現在はプレースホルダー実装
          console.log('Authentication successful, but principal extraction not implemented');
        }
        
        // 本番環境では適切なエラーメッセージを表示
        Alert.alert(
          'Authentication',
          'Internet Identity mobile authentication is not fully implemented yet. Please use the web version.',
          [{ text: 'OK' }]
        );
        
        return null;
      } catch (browserError) {
        console.error('Browser authentication error:', browserError);
        throw new Error('Failed to open authentication browser');
      }
    } catch (error) {
      console.error('Mobile auth error:', error);
      throw error;
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