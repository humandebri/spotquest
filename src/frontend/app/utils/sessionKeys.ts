import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Buffer } from 'buffer';

type Storage = {
  getItem?: (k: string) => Promise<string | null>;
  setItem?: (k: string, v: string) => Promise<void>;
};

const APP_KEY = 'oisy.appKey';

export async function getOrCreateSessionIdentity(storage: Storage): Promise<Ed25519KeyIdentity> {
  const raw = storage.getItem ? await storage.getItem(APP_KEY) : null;
  if (raw) {
    try {
      return Ed25519KeyIdentity.fromJSON(raw);
    } catch {}
  }
  const id = await Ed25519KeyIdentity.generate();
  if (storage.setItem) {
    await storage.setItem(APP_KEY, JSON.stringify(id.toJSON()));
  }
  return id;
}

export async function getSessionPublicKeyB64(storage: Storage): Promise<string> {
  const id = await getOrCreateSessionIdentity(storage);
  const der = id.getPublicKey().toDer();
  return Buffer.from(der).toString('base64');
}
