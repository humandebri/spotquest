import { create } from 'zustand';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/identity';
import { internetIdentityService } from '../services/internetIdentity';
import { IIAuthConfig } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  principal: Principal | null;
  identity: Identity | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  
  login: (config?: IIAuthConfig) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkIsAdmin: () => boolean;
  clearError: () => void;
}

// 管理者のPrincipal IDリスト
const ADMIN_PRINCIPALS = [
  '4wbqy-noqfb-3dunk-64f7k-4v54w-kzvti-l24ky-jaz3f-73y36-gegjt-cqe',
  '2vxsx-fae', // Development test principal
];

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  principal: null,
  identity: null,
  isLoading: false,
  error: null,
  isAdmin: false,

  login: async (config?: IIAuthConfig): Promise<boolean> => {
    set({ isLoading: true, error: null });
    try {
      const result = await internetIdentityService.login(config);
      
      if (result.success) {
        const principal = await internetIdentityService.getPrincipal();
        const identity = await internetIdentityService.getIdentity();
        
        if (principal) {
          const isAdmin = ADMIN_PRINCIPALS.includes(principal.toString());
          set({ 
            isAuthenticated: true, 
            principal,
            identity,
            isAdmin,
            isLoading: false,
            error: null
          });
          return true;
        } else {
          set({ 
            isAuthenticated: false, 
            principal: null,
            identity: null,
            isAdmin: false,
            isLoading: false,
            error: 'Failed to retrieve user principal' 
          });
          return false;
        }
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          identity: null,
          isAdmin: false,
          isLoading: false,
          error: result.error || 'Authentication failed'
        });
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed';
      if (error instanceof Error) {
        if (error.message.includes('initialization')) {
          errorMessage = 'Authentication service initialization failed. Please try again.';
        } else if (error.message.includes('browser')) {
          errorMessage = 'Failed to open authentication browser.';
        } else {
          errorMessage = error.message;
        }
      }
      
      set({ 
        isAuthenticated: false,
        principal: null,
        identity: null,
        isAdmin: false,
        isLoading: false,
        error: errorMessage
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await internetIdentityService.logout();
      set({ 
        isAuthenticated: false, 
        principal: null,
        identity: null,
        isAdmin: false,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Logout error:', error);
      set({ 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const isAuthenticated = await internetIdentityService.isAuthenticated();
      
      if (isAuthenticated) {
        const principal = await internetIdentityService.getPrincipal();
        const identity = await internetIdentityService.getIdentity();
        
        if (principal) {
          const isAdmin = ADMIN_PRINCIPALS.includes(principal.toString());
          set({ 
            isAuthenticated: true, 
            principal,
            identity,
            isAdmin,
            isLoading: false,
            error: null
          });
        } else {
          set({ 
            isAuthenticated: false, 
            principal: null,
            identity: null,
            isAdmin: false,
            isLoading: false,
            error: null
          });
        }
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          identity: null,
          isAdmin: false,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ 
        isAuthenticated: false,
        principal: null,
        identity: null,
        isAdmin: false,
        isLoading: false,
        error: null
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  checkIsAdmin: () => {
    const state = get();
    return state.isAdmin;
  },
}));