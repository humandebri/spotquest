import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

export type GoogleAuthResult = {
  idToken?: string;
  accessToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  raw?: any;
};

export async function signInWithGoogle(): Promise<GoogleAuthResult | null> {
  // Prefer iOS native client + Code PKCE to comply with Google policy
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
  const usingIOSClient = !!iosClientId;
  const clientId = usingIOSClient ? iosClientId : webClientId;
  if (!clientId) {
    throw new Error('Missing Google OAuth client id. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS or EXPO_PUBLIC_GOOGLE_CLIENT_ID');
  }

  // Build redirect URI
  // Build redirect URI
  // For iOS native client, Google expects an exact value: com.googleusercontent.apps.<client_id>:/oauthredirect
  const redirectUri = usingIOSClient
    ? (`com.googleusercontent.apps.${clientId}:/oauthredirect`)
    : makeRedirectUri({ useProxy: true, preferLocalhost: false, isTripleSlashed: true });

  // Debug logging to verify chosen flow
  try {
    console.log('🔐 GoogleAuth config', { usingIOSClient, clientId, redirectUri });
  } catch {}

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    responseType: usingIOSClient ? AuthSession.ResponseType.Code : AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'email', 'profile'],
    prompt: AuthSession.Prompt.SelectAccount,
    // Native iOS: Code + PKCE; Web proxy: id_token without PKCE
    usePKCE: usingIOSClient,
  });

  if (usingIOSClient) {
    // Authorization Code + PKCE (no client secret)
    await request.makeAuthUrlAsync(discovery, { useProxy: false });
    const auth = await request.promptAsync(discovery, { useProxy: false });
    if (auth.type !== 'success') return null;
    const code = (auth as any).params?.code as string | undefined;
    if (!code) return null;
    const token = await AuthSession.exchangeCodeAsync(
      {
        code,
        clientId,
        redirectUri,
        // PKCE
        extraParams: { code_verifier: request.codeVerifier || '' },
      },
      discovery
    );
    return { idToken: (token as any).id_token, accessToken: token.accessToken, raw: token } as any;
  } else {
    // Web client via Expo proxy (id_token)
    await request.makeAuthUrlAsync(discovery, { useProxy: true });
    const result = await request.promptAsync(discovery, { useProxy: true });
    if (result.type !== 'success') return null;
    const idToken = (result as any).params?.id_token;
    return { idToken, raw: result };
  }
}
