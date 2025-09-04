import { DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';

export type OisyReturn = {
  principal?: string;
  delegation?: string; // JSON or base64-encoded JSON
  userPublicKey?: string; // base64 DER
  delegationPubkey?: string; // base64 DER
};

// Try to parse delegation: accept plain JSON, URL-encoded JSON, or base64 JSON
export function parseDelegationString(input: string): any | null {
  try {
    // Try raw JSON
    return JSON.parse(input);
  } catch {}
  try {
    // Try URL-decoded JSON
    const dec = decodeURIComponent(input);
    return JSON.parse(dec);
  } catch {}
  try {
    // Try base64 JSON
    const buf = Buffer.from(input, 'base64');
    return JSON.parse(buf.toString('utf-8'));
  } catch {}
  return null;
}

// Build a DelegationIdentity from session signer and Oisy-provided delegation chain
export function buildDelegationIdentity(
  sessionIdentity: Ed25519KeyIdentity,
  delegationJson: any
): DelegationIdentity {
  // DelegationIdentity expects a chain format compatible with @dfinity/identity
  // Many wallets return the same structure as Internet Identity: { delegations: [...], publicKey: <hex/base64> }
  return DelegationIdentity.fromDelegation(sessionIdentity, delegationJson);
}

