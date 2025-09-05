import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Buffer } from 'buffer';

type Storage = {
  getItem?: (k: string) => Promise<string | null>;
  setItem?: (k: string, v: string) => Promise<void>;
};

const APP_KEY = 'oisy.appKey';
const APP_KEY_PREFIX = 'oisy.appKey';

export async function getOrCreateSessionIdentity(storage: Storage, namespace?: string): Promise<Ed25519KeyIdentity> {
  const storageKey = namespace ? `${APP_KEY_PREFIX}:${namespace}` : APP_KEY;
  const raw = storage.getItem ? await storage.getItem(storageKey) : null;
  if (raw) {
    try {
      return Ed25519KeyIdentity.fromJSON(raw);
    } catch {}
  }
  const id = await Ed25519KeyIdentity.generate();
  if (storage.setItem) {
    await storage.setItem(storageKey, JSON.stringify(id.toJSON()));
  }
  return id;
}

export async function getSessionPublicKeyB64(storage: Storage, namespace?: string): Promise<string> {
  const id = await getOrCreateSessionIdentity(storage, namespace);
  const der = id.getPublicKey().toDer();
  return Buffer.from(der).toString('base64');
}

export async function clearSessionIdentity(storage: Storage, namespace?: string) {
  const storageKey = namespace ? `${APP_KEY_PREFIX}:${namespace}` : APP_KEY;
  try {
    if ((storage as any).removeItem) {
      await (storage as any).removeItem(storageKey);
    } else if ((storage as any).setItem) {
      await (storage as any).setItem(storageKey, '');
    }
  } catch {}
}
