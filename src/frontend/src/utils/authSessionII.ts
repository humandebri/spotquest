/**
 * Expo AuthSession を使った Internet Identity 認証ユーティリティ
 * カスタムURLスキームを使わずに、Expoのプロキシ経由で認証を処理
 */

import React from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { debugLog } from './debugConfig';

// WebBrowserの認証セッションを確実に閉じる
WebBrowser.maybeCompleteAuthSession();

interface AuthSessionResult {
  type: 'success' | 'cancel' | 'dismiss';
  delegation?: string;
  publicKey?: string;
  sessionId?: string;
  error?: string;
}

/**
 * AuthSessionを使用したII認証のメインフック
 */
export const useIIAuthSession = () => {
  // Expoプロキシを使用したリダイレクトURI
  // 本番環境でも開発環境でも同じように動作
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true, // https://auth.expo.io/@hude/spotquest を使用
    projectNameForProxy: '@hude/spotquest'
  });

  debugLog('AUTH_SESSION', 'Redirect URI:', redirectUri);

  // セッション状態を保持（state/nonce照合用）
  const sessionStateRef = React.useRef<{
    sessionId: string;
    state: string;
    nonce: string;
  } | null>(null);

  /**
   * II認証を開始
   * @param sessionId - バックエンドから取得したセッションID
   * @param iiIntegrationUrl - II Integration CanisterのURL
   */
  const authenticateWithII = async (
    sessionId: string,
    iiIntegrationUrl: string
  ): Promise<AuthSessionResult> => {
    try {
      // state/nonce を保存（後で照合用）
      sessionStateRef.current = {
        sessionId,
        state: sessionId,
        nonce: sessionId
      };

      // II認証URLを構築
      // 注意: IIはフラグメント(#)を使用するため、特殊な処理が必要
      const authUrl = `https://identity.ic0.app/#authorize?` +
        `client_id=${encodeURIComponent(iiIntegrationUrl)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${sessionId}&` +
        `response_type=id_token&` +
        `scope=openid&` +
        `nonce=${sessionId}`;

      debugLog('AUTH_SESSION', 'Opening auth URL:', authUrl);

      // AuthSessionを開始
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri,
        {
          showInRecents: false,
          // iOS 11+ ではSFAuthenticationSessionを使用
          preferEphemeralSession: false
        }
      );

      debugLog('AUTH_SESSION', 'Auth session result:', result);

      if (result.type === 'success' && result.url) {
        // URLから認証情報を抽出
        const params = extractAuthParams(result.url);
        
        // state/nonce の照合
        if (sessionStateRef.current) {
          if (params.state !== sessionStateRef.current.state) {
            debugLog('AUTH_SESSION', 'State mismatch!', {
              expected: sessionStateRef.current.state,
              received: params.state
            });
            return {
              type: 'dismiss',
              error: 'State mismatch - possible CSRF attack'
            };
          }
        }
        
        // delegation, delegationPubkey, userPublicKey の3項目すべてをチェック
        if (params.delegation && params.delegationPubkey && params.userPublicKey) {
          return {
            type: 'success',
            delegation: params.delegation,
            publicKey: params.userPublicKey,
            sessionId: sessionId
          };
        } else {
          debugLog('AUTH_SESSION', 'Missing required params:', params);
          return {
            type: 'success',
            error: 'Missing required authentication parameters'
          };
        }
      } else if (result.type === 'cancel') {
        return { type: 'cancel' };
      } else {
        return { type: 'dismiss' };
      }
    } catch (error) {
      debugLog('AUTH_SESSION', 'Authentication error:', error);
      return {
        type: 'dismiss',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  /**
   * URLから認証パラメータを抽出
   * IIはフラグメント(#)にパラメータを含めて返す
   * 例: https://auth.expo.io/@hude/spotquest#delegation=...&delegationPubkey=...&userPublicKey=...&state=...
   */
  const extractAuthParams = (url: string): {
    delegation?: string;
    delegationPubkey?: string;
    userPublicKey?: string;
    state?: string;
    [key: string]: string | undefined;
  } => {
    try {
      // URLからフラグメント部分を抽出
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) {
        debugLog('AUTH_SESSION', 'No fragment found in URL');
        return {};
      }
      
      const fragment = url.slice(hashIndex + 1);
      
      // クエリパラメータ形式でパースを試みる
      const params = new URLSearchParams(fragment);
      
      const result: { [key: string]: string | undefined } = {};
      
      // すべてのパラメータを抽出
      for (const [key, value] of params) {
        result[key] = decodeURIComponent(value);
      }
      
      // フォールバック: URLSearchParamsがうまく動作しない場合の手動パース
      if (!result.delegation && fragment.includes('delegation=')) {
        const pairs = fragment.split('&');
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            result[key] = decodeURIComponent(value);
          }
        }
      }
      
      debugLog('AUTH_SESSION', 'Extracted params:', {
        hasДelegation: !!result.delegation,
        hasDelegationPubkey: !!result.delegationPubkey,
        hasUserPublicKey: !!result.userPublicKey,
        hasState: !!result.state,
        allKeys: Object.keys(result)
      });
      
      return result;
    } catch (error) {
      debugLog('AUTH_SESSION', 'Failed to parse URL:', error);
      return {};
    }
  };

  /**
   * 開発環境用: ローカルのリダイレクトURIを使用
   */
  const getLocalRedirectUri = () => {
    if (Platform.OS === 'web') {
      return window.location.origin + '/auth/callback';
    }
    
    // ローカル開発では exp:// スキームを使用
    return Linking.createURL('auth/callback');
  };

  return {
    authenticateWithII,
    redirectUri,
    getLocalRedirectUri
  };
};

/**
 * AuthSessionの結果をexpo-ii-integrationに渡すためのヘルパー
 */
export const processAuthSessionResult = (
  result: AuthSessionResult,
  iiIntegration: any
): boolean => {
  if (result.type === 'success' && result.delegation) {
    try {
      // expo-ii-integrationにdelegationを設定
      // 注意: 実際のexpo-ii-integrationのAPIに合わせて調整が必要
      iiIntegration.handleAuthResponse({
        delegation: result.delegation,
        publicKey: result.publicKey,
        sessionId: result.sessionId
      });
      
      return true;
    } catch (error) {
      debugLog('AUTH_SESSION', 'Failed to process delegation:', error);
      return false;
    }
  }
  
  return false;
};