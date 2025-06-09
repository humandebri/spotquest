import { Identity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  principal: Principal | null;
  identity: Identity | null;
  error: string | null;
  isAdmin: boolean;
}

export interface IIAuthConfig {
  identityProvider?: string;
  maxTimeToLive?: bigint;
  derivationOrigin?: string;
  windowOpenerFeatures?: string;
  idleOptions?: {
    disableIdle?: boolean;
    disableDefaultIdleCallback?: boolean;
    idleTimeout?: number;
    captureScroll?: boolean;
    scrollDebounce?: number;
  };
}

export interface AuthContextType extends AuthState {
  login: (config?: IIAuthConfig) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export interface SecureAuthData {
  delegation: string;
  publicKey: string;
  expiry: number;
  origin: string;
}

export interface AuthStorage {
  save: (key: string, data: SecureAuthData) => Promise<void>;
  load: (key: string) => Promise<SecureAuthData | null>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}