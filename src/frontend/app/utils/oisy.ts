import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { getSessionPublicKeyB64 } from './sessionKeys';

function getWalletReturnUrls(params: OisyParams) {
  const canisterId = process.env.EXPO_PUBLIC_II_INTEGRATION_CANISTER_ID || '';
  const base = canisterId ? `https://${canisterId}.raw.icp0.io` : '';
  const webReturn = base ? `${base}/wallet-return` : params.returnUrl;
  const appReturn = params.returnUrl; // spotquest:///wallet-connect
  return { webReturn, appReturn };
}

export type OisyParams = {
  returnUrl: string; // e.g. spotquest:///wallet-connect
  appName?: string;
  appIconUrl?: string;
  request?: string; // optional app-specific request payload
};

// Build query string shared by both scheme and https fallbacks
function buildQuery(params: OisyParams) {
  const usp = new URLSearchParams();
  usp.set('returnUrl', params.returnUrl);
  if (params.appName) usp.set('appName', params.appName);
  if (params.appIconUrl) usp.set('appIcon', params.appIconUrl);
  if (params.request) usp.set('request', params.request);
  const appId = (Constants as any)?.manifest2?.extra?.eas?.projectId || '';
  if (appId) usp.set('appId', String(appId));
  return usp.toString();
}

// Attempt to open Oisy using custom scheme first; fall back to HTTPS homepage
export async function openOisyConnect(params: OisyParams & { includePubkey?: boolean; storage?: any }) {
  const { webReturn, appReturn } = getWalletReturnUrls(params);
  let q = buildQuery({ ...params, returnUrl: webReturn });
  // Add common callback synonyms for compatibility
  const extra = new URLSearchParams();
  extra.set('callback', webReturn);
  extra.set('callbackUrl', webReturn);
  extra.set('redirect', webReturn);
  extra.set('redirectUrl', webReturn);
  extra.set('redirect_uri', webReturn);
  extra.set('x-success', appReturn);
  q += `&${extra.toString()}`;
  if (params.includePubkey && params.storage) {
    try {
      const pubkey = await getSessionPublicKeyB64(params.storage);
      q += `&pubkey=${encodeURIComponent(pubkey)}`;
    } catch {}
  }
  const candidates = [
    `oisy://app-connect?${q}`,
    `oisy://connect?${q}`,
    // If universal links exist, allow overriding via env; otherwise fallback to homepage
    process.env.EXPO_PUBLIC_OISY_CONNECT_BASE
      ? `${process.env.EXPO_PUBLIC_OISY_CONNECT_BASE}?${q}`
      : undefined,
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {}
  }
  // Final fallback: open Oisy website (user can proceed manually)
  try {
    await Linking.openURL('https://oisy.com');
  } catch {}
}
