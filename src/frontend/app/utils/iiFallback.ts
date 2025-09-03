import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Buffer } from 'buffer';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

type Storage = {
  getItem?: (k: string) => Promise<string | null>;
  setItem?: (k: string, v: string) => Promise<void>;
};

// Prepare Ed25519 identity if missing and return public key (base64)
export async function prepareIIKeysAndGetPubKey(secureStorage: Storage): Promise<string | null> {
  const APP_KEY = 'expo-ii-integration.appKey';
  const PUB_KEY = 'expo-ii-integration.publicKey';

  try {
    // Try existing appKey
    const existing = secureStorage.getItem ? await secureStorage.getItem(APP_KEY) : null;
    let identity: Ed25519KeyIdentity | null = null;

    if (existing) {
      try {
        identity = Ed25519KeyIdentity.fromJSON(existing);
      } catch {}
    }

    if (!identity) {
      identity = await Ed25519KeyIdentity.generate();
      if (secureStorage.setItem) {
        await secureStorage.setItem(APP_KEY, JSON.stringify(identity.toJSON()));
      }
    }

    const der = identity.getPublicKey().toDer();
    const pubB64 = Buffer.from(der).toString('base64');
    if (secureStorage.setItem) {
      await secureStorage.setItem(PUB_KEY, pubB64);
    }
    return pubB64;
  } catch (e) {
    return null;
  }
}

export function buildNewSessionUrl(
  canisterId: string,
  publicKeyB64: string,
  deepLinkType: 'expo-go' | 'dev-client' | 'modern'
) {
  const base = `https://${canisterId}.icp0.io/newSession`;
  const params = new URLSearchParams();
  params.set('pubkey', publicKeyB64);
  params.set('deep-link-type', deepLinkType);
  return `${base}?${params.toString()}`;
}

// Open newSession in a regular browser tab (SFSafariViewController)
export async function openNewSessionInBrowser(newSessionUrl: string) {
  const result = await WebBrowser.openBrowserAsync(newSessionUrl, {
    enableBarCollapsing: true,
    dismissButtonStyle: 'close',
    controlsColor: '#3282b8',
    readerMode: false,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  } as any);
  return result;
}

// High-level helper: prepare keys, build URL, and open in external Safari for best reliability
export async function startExternalLogin(
  iiCanisterId: string,
  secureStorage: any,
  getDeepLinkType: () => 'expo-go' | 'dev-client' | 'modern',
  LinkingModule: { openURL: (url: string) => Promise<void> }
) {
  const pubkey = await prepareIIKeysAndGetPubKey(secureStorage);
  if (!pubkey) throw new Error('Failed to prepare keys');
  const deepLinkType = getDeepLinkType();
  const url = buildNewSessionUrl(iiCanisterId, pubkey, deepLinkType);
  await LinkingModule.openURL(url);
}
