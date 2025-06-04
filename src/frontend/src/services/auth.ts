import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

const PLUG_WHITELIST = [
  'ryjl3-tyaaa-aaaaa-aaaba-cai', // ICP Ledger
];

export interface AuthService {
  login: (provider: 'ii' | 'plug') => Promise<Principal | null>;
  logout: () => Promise<void>;
  getIdentity: () => Promise<any>;
  isAuthenticated: () => Promise<boolean>;
  getPrincipal: () => Promise<Principal | null>;
}

class AuthServiceImpl implements AuthService {
  private authClient: AuthClient | null = null;
  private plugPrincipal: Principal | null = null;

  async init() {
    this.authClient = await AuthClient.create();
    
    // For testing purposes, check if we're in development mode
    if (window.location.hostname === 'localhost') {
      // Mock authenticated state for development
      const mockAuth = localStorage.getItem('mockAuth') === 'true';
      if (mockAuth) {
        console.log('Using mock authentication for development');
      }
    }
  }

  async login(provider: 'ii' | 'plug'): Promise<Principal | null> {
    if (provider === 'ii') {
      return this.loginWithII();
    } else {
      return this.loginWithPlug();
    }
  }

  private async loginWithII(): Promise<Principal | null> {
    if (!this.authClient) {
      await this.init();
    }

    // Development mode - use mock authentication
    if (window.location.hostname === 'localhost' && !window.location.port.includes('4943')) {
      console.log('Using mock authentication for development');
      localStorage.setItem('mockAuth', 'true');
      // Return a mock principal
      return Principal.fromText('2vxsx-fae');
    }

    return new Promise((resolve) => {
      // Default to local development URL - we'll determine IC vs local based on window location
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const identityProvider = isLocal
        ? 'http://localhost:4943'
        : 'https://identity.ic0.app';

      this.authClient!.login({
        identityProvider,
        onSuccess: async () => {
          const identity = this.authClient!.getIdentity();
          const principal = identity.getPrincipal();
          resolve(principal);
        },
        onError: () => {
          resolve(null);
        },
      });
    });
  }

  private async loginWithPlug(): Promise<Principal | null> {
    const hasPlug = window.ic?.plug;
    
    if (!hasPlug) {
      window.open('https://plugwallet.ooo/', '_blank');
      return null;
    }

    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = isLocal ? 'http://localhost:4943' : 'https://ic0.app';

      const connected = await window.ic.plug.requestConnect({
        whitelist: PLUG_WHITELIST,
        host
      });

      if (!connected) {
        return null;
      }

      const principal = await window.ic.plug.agent.getPrincipal();
      this.plugPrincipal = principal;
      return principal;
    } catch (error) {
      console.error('Plug wallet connection failed:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    if (this.authClient) {
      await this.authClient.logout();
    }
    if (window.ic?.plug) {
      await window.ic.plug.disconnect();
    }
    this.plugPrincipal = null;
  }

  async getIdentity() {
    if (this.plugPrincipal) {
      return window.ic.plug.agent;
    }
    return this.authClient?.getIdentity();
  }

  async isAuthenticated(): Promise<boolean> {
    // Check mock authentication for development
    if (window.location.hostname === 'localhost' && localStorage.getItem('mockAuth') === 'true') {
      return true;
    }
    
    if (this.plugPrincipal) {
      return await window.ic?.plug?.isConnected() || false;
    }
    return await this.authClient?.isAuthenticated() || false;
  }

  async getPrincipal(): Promise<Principal | null> {
    // Check mock authentication for development
    if (window.location.hostname === 'localhost' && localStorage.getItem('mockAuth') === 'true') {
      return Principal.fromText('2vxsx-fae');
    }
    
    if (this.plugPrincipal) {
      return this.plugPrincipal;
    }
    const identity = await this.getIdentity();
    return identity?.getPrincipal() || null;
  }
}

// Declare window.ic for TypeScript
declare global {
  interface Window {
    ic?: {
      plug?: {
        requestConnect: (options: {
          whitelist: string[];
          host?: string;
        }) => Promise<boolean>;
        disconnect: () => Promise<void>;
        isConnected: () => Promise<boolean>;
        agent: any;
      };
    };
  }
}

export const authService = new AuthServiceImpl();