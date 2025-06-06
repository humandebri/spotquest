import { AuthClient } from '@dfinity/auth-client';
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
    this.authClient = await AuthClient.create({
      idleOptions: {
        idleTimeout: 1000 * 60 * 60 * 24, // 24 hours
        disableDefaultIdleCallback: true,
      },
    });
    
    // Restore session from localStorage
    await this.restoreSession();
    
    // For testing purposes, check if we're in development mode
    if (window.location.hostname === 'localhost') {
      // Mock authenticated state for development
      const mockAuth = localStorage.getItem('mockAuth') === 'true';
      if (mockAuth) {
        console.log('Using mock authentication for development');
      }
    }
  }

  private async restoreSession() {
    try {
      const savedSession = localStorage.getItem('authSession');
      if (savedSession) {
        const { provider, principal } = JSON.parse(savedSession);
        
        if (provider === 'plug') {
          this.plugPrincipal = Principal.fromText(principal);
        }
        
        console.log('Session restored for provider:', provider);
      }
    } catch (error) {
      console.warn('Failed to restore session:', error);
      localStorage.removeItem('authSession');
    }
  }

  private saveSession(provider: 'ii' | 'plug', principal: Principal) {
    try {
      const session = {
        provider,
        principal: principal.toString(),
        timestamp: Date.now(),
      };
      localStorage.setItem('authSession', JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  }

  private clearSession() {
    localStorage.removeItem('authSession');
    localStorage.removeItem('mockAuth');
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
      const mockPrincipal = Principal.fromText('2vxsx-fae');
      this.saveSession('ii', mockPrincipal);
      return mockPrincipal;
    }

    return new Promise((resolve) => {
      // Determine IC vs local based on window location
      const isLocal = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('10.32.1.54');
      const identityProvider = isLocal
        ? `${window.location.protocol}//${window.location.hostname}:4943`
        : 'https://identity.ic0.app';

      this.authClient!.login({
        identityProvider,
        onSuccess: async () => {
          const identity = this.authClient!.getIdentity();
          const principal = identity.getPrincipal();
          this.saveSession('ii', principal);
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
      const isLocal = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('10.32.1.54');
      const host = isLocal ? `${window.location.protocol}//${window.location.hostname}:4943` : 'https://ic0.app';

      const connected = await window.ic!.plug!.requestConnect({
        whitelist: PLUG_WHITELIST,
        host
      });

      if (!connected) {
        return null;
      }

      const principal = await window.ic!.plug!.agent.getPrincipal();
      this.plugPrincipal = principal;
      this.saveSession('plug', principal);
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
    if (window.ic && window.ic.plug) {
      await window.ic.plug.disconnect();
    }
    this.plugPrincipal = null;
    this.clearSession();
  }

  async getIdentity() {
    if (this.plugPrincipal && window.ic && window.ic.plug) {
      return window.ic.plug.agent;
    }
    return this.authClient?.getIdentity();
  }

  async isAuthenticated(): Promise<boolean> {
    // Initialize if not done yet
    if (!this.authClient) {
      await this.init();
    }
    
    // Check for saved session first
    const savedSession = localStorage.getItem('authSession');
    if (savedSession) {
      try {
        const { provider, principal, timestamp } = JSON.parse(savedSession);
        // Check if session is less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          if (provider === 'plug') {
            this.plugPrincipal = Principal.fromText(principal);
            return true;
          } else if (provider === 'ii') {
            // For II, check with auth client
            const isAuth = await this.authClient?.isAuthenticated();
            if (isAuth) return true;
          }
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
    }
    
    // Check mock authentication for development
    if (window.location.hostname === 'localhost' && localStorage.getItem('mockAuth') === 'true') {
      return true;
    }
    
    if (this.plugPrincipal && window.ic && window.ic.plug) {
      return await window.ic.plug.isConnected() || false;
    }
    return await this.authClient?.isAuthenticated() || false;
  }

  async getPrincipal(): Promise<Principal | null> {
    // Initialize if not done yet
    if (!this.authClient) {
      await this.init();
    }
    
    // Check for saved session first
    const savedSession = localStorage.getItem('authSession');
    if (savedSession) {
      try {
        const { provider, principal } = JSON.parse(savedSession);
        if (provider === 'plug' && !this.plugPrincipal) {
          this.plugPrincipal = Principal.fromText(principal);
        }
        return Principal.fromText(principal);
      } catch (e) {
        console.error('Session principal error:', e);
      }
    }
    
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

// Initialize on load
if (typeof window !== 'undefined') {
  authService.init().catch(console.error);
}