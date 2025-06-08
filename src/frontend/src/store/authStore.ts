import { create } from 'zustand';
import { Principal } from '@dfinity/principal';
import { authService } from '../services/auth';

interface AuthState {
  isAuthenticated: boolean;
  principal: Principal | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  checkIsAdmin: () => boolean;
}

// 管理者のPrincipal IDリスト（実際の管理者IDに置き換えてください）
const ADMIN_PRINCIPALS = [
  '4wbqy-noqfb-3dunk-64f7k-4v54w-kzvti-l24ky-jaz3f-73y36-gegjt-cqe', // Admin principal
];

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  principal: null,
  isLoading: false,
  error: null,
  isAdmin: false,

  login: async () => {
    set({ isLoading: true, error: null });
    try {
      const principal = await authService.login();
      if (principal) {
        const isAdmin = ADMIN_PRINCIPALS.includes(principal.toString());
        set({ 
          isAuthenticated: true, 
          principal,
          isAdmin,
          isLoading: false 
        });
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          isAdmin: false,
          isLoading: false,
          error: 'Login failed' 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      set({ 
        isAuthenticated: false,
        principal: null,
        isAdmin: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ 
        isAuthenticated: false, 
        principal: null,
        isAdmin: false,
        isLoading: false 
      });
    } catch (error) {
      console.error('Logout error:', error);
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        const principal = await authService.getPrincipal();
        const isAdmin = principal ? ADMIN_PRINCIPALS.includes(principal.toString()) : false;
        set({ 
          isAuthenticated: true, 
          principal,
          isAdmin,
          isLoading: false 
        });
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          isAdmin: false,
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ 
        isAuthenticated: false,
        principal: null,
        isAdmin: false,
        isLoading: false 
      });
    }
  },

  checkIsAdmin: () => {
    const state = get();
    return state.isAdmin;
  },
}));