/**
 * expo-auth-session v6対応のII認証フック
 * URLスキーム不要で、Expo Go、シミュレータ、TestFlightすべてで動作
 */

import React, { useState, useEffect } from 'react';
import {
  useAuthRequest,
  ResponseType,
  makeRedirectUri,
  AuthRequestConfig,
  AuthSessionResult,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { gameService } from '../services/game';
import { debugLog } from '../utils/debugConfig';
import { CANISTER_ID_UNIFIED } from '../constants';

// WebBrowserの認証セッションを確実に閉じる
WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  success: boolean;
  error?: string;
}

interface SessionInfo {
  sessionId: string;
  publicKey: string;
  clientId: string;
}

export const useIIAuthSessionV6 = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const iiIntegration = useIIIntegrationContext();

  // Expoプロキシを使用したリダイレクトURI
  const redirectUri = makeRedirectUri();

  debugLog('AUTH_SESSION_V6', 'Redirect URI:', redirectUri);

  // 公開鍵を生成
  const generatePublicKey = async (): Promise<string> => {
    try {
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const publicKey = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return publicKey;
    } catch (error) {
      debugLog('AUTH_SESSION_V6', 'Failed to generate public key:', error);
      return Date.now().toString();
    }
  };

  // gameServiceを初期化
  const initializeGameService = async () => {
    if (!gameService.isInitialized) {
      debugLog('AUTH_SESSION_V6', 'Initializing game service...');
      const { Ed25519KeyIdentity } = await import('@dfinity/identity');
      const tempIdentity = Ed25519KeyIdentity.generate();
      await gameService.init(tempIdentity);
      debugLog('AUTH_SESSION_V6', 'Game service initialized');
    }
  };

  // セッション作成
  const initializeSession = async () => {
    await initializeGameService();
    
    const publicKey = await generatePublicKey();
    debugLog('AUTH_SESSION_V6', 'Generated public key:', publicKey);
    
    const { sessionId, authorizeUrl } = await gameService.newSession(publicKey);
    debugLog('AUTH_SESSION_V6', 'New session created:', { sessionId, authorizeUrl });
    
    // authorizeUrlからclient_idを抽出
    const urlParams = new URLSearchParams(authorizeUrl.split('?')[1] || '');
    const clientId = urlParams.get('client_id') || `https://${CANISTER_ID_UNIFIED}.raw.icp0.io`;
    
    setSessionInfo({ sessionId, publicKey, clientId });
    return sessionId;
  };

  // useAuthRequestの設定（sessionInfo依存）
  const requestConfig: AuthRequestConfig = {
    clientId: sessionInfo?.clientId || `https://${CANISTER_ID_UNIFIED}.raw.icp0.io`,
    responseType: ResponseType.Token,  // JWT検証を回避するためTokenに変更
    scopes: ['openid'],
    redirectUri,
    state: sessionInfo?.sessionId || 'pending',
    extraParams: { 
      nonce: sessionInfo?.sessionId || 'pending',
    },
  };

  const [request, response, promptAsync] = useAuthRequest(
    requestConfig,
    { 
      authorizationEndpoint: 'https://identity.ic0.app/%23authorize' 
    }
  );

  debugLog('AUTH_SESSION_V6', 'Request ready:', !!request);
  debugLog('AUTH_SESSION_V6', 'Response:', response);

  // 認証実行
  const authenticate = async (): Promise<AuthResult> => {
    if (isLoading) {
      return { success: false, error: 'Authentication already in progress' };
    }

    setIsLoading(true);

    try {
      // セッション初期化
      if (!sessionInfo) {
        debugLog('AUTH_SESSION_V6', 'Initializing session...');
        await initializeSession();
        
        // requestが準備できるまで少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // requestが準備できているか確認
      if (!request) {
        throw new Error('Auth request not ready. Please try again.');
      }

      debugLog('AUTH_SESSION_V6', 'Opening browser with promptAsync...');
      debugLog('AUTH_SESSION_V6', 'Request details:', {
        clientId: request.clientId,
        redirectUri: request.redirectUri,
        state: request.state,
        responseType: request.responseType,
      });

      // ブラウザを開く（Expo Proxyを使用）
      await promptAsync({ 
        useProxy: true, 
        redirectUri 
      } as any);

      // 結果はresponseで処理されるため、ここでは成功を返す
      return { success: true };

    } catch (error) {
      debugLog('AUTH_SESSION_V6', 'Authentication error:', error);
      setIsLoading(false);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  };

  // response監視
  useEffect(() => {
    if (!response || !sessionInfo) return;

    debugLog('AUTH_SESSION_V6', 'Response received:', {
      type: response.type,
      response,
    });

    if (response.type === 'success' && 'params' in response) {
      const params = (response as any).params || {};
      const { delegation, userPublicKey, delegationPubkey, state } = params;

      // 型ガード
      if (typeof delegation !== 'string' || 
          typeof userPublicKey !== 'string' || 
          typeof delegationPubkey !== 'string') {
        debugLog('AUTH_SESSION_V6', 'Invalid response params:', params);
        setIsLoading(false);
        return;
      }

      // state照合
      if (state !== sessionInfo.sessionId) {
        debugLog('AUTH_SESSION_V6', 'State mismatch!', {
          expected: sessionInfo.sessionId,
          received: state
        });
        Alert.alert('セキュリティエラー', 'セッション情報が一致しません。');
        setIsLoading(false);
        return;
      }

      // 非同期処理
      (async () => {
        try {
          debugLog('AUTH_SESSION_V6', 'Processing delegation...');
          
          // saveDelegate
          const saveDelegateResult = await gameService.saveDelegate(
            sessionInfo.sessionId,
            delegation,
            userPublicKey,
            delegationPubkey
          );

          if (!saveDelegateResult.success) {
            throw new Error(saveDelegateResult.error || 'Failed to save delegation');
          }

          // closeSession
          await gameService.closeSession(sessionInfo.sessionId);

          // expo-ii-integrationに設定
          await setDelegationToIIIntegration(delegation, userPublicKey, delegationPubkey);

          debugLog('AUTH_SESSION_V6', '✅ Authentication completed successfully!');
          
        } catch (error) {
          debugLog('AUTH_SESSION_V6', 'Failed to process delegation:', error);
          Alert.alert('エラー', '認証情報の処理に失敗しました。');
        } finally {
          setIsLoading(false);
        }
      })();
    } else {
      setIsLoading(false);
    }
  }, [response, sessionInfo]);

  // expo-ii-integrationにdelegationを設定
  const setDelegationToIIIntegration = async (
    delegation: string,
    userPublicKey: string,
    delegationPubkey: string
  ): Promise<void> => {
    try {
      if (iiIntegration && 'setDelegation' in iiIntegration && typeof iiIntegration.setDelegation === 'function') {
        debugLog('AUTH_SESSION_V6', 'Setting delegation via setDelegation');
        await iiIntegration.setDelegation(delegation, userPublicKey, delegationPubkey);
      } else if (iiIntegration && 'refreshAuth' in iiIntegration && typeof iiIntegration.refreshAuth === 'function') {
        debugLog('AUTH_SESSION_V6', 'Setting delegation via refreshAuth');
        await iiIntegration.refreshAuth();
      } else {
        debugLog('AUTH_SESSION_V6', 'Warning: Could not find method to set delegation');
      }
    } catch (error) {
      debugLog('AUTH_SESSION_V6', 'Failed to set delegation to II integration:', error);
      throw error;
    }
  };

  return {
    authenticate,
    isLoading,
    response,
    redirectUri,
  };
};