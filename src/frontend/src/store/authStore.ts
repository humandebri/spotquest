import { create } from 'zustand';
import { Principal } from '@dfinity/principal';
import { authService } from '../services/auth';

interface AuthState {
  isAuthenticated: boolean;
  principal: Principal | null;
  isLoading: boolean;
  error: string | null;
  
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  principal: null,
  isLoading: true,
  error: null,

  login: async () => {
    set({ isLoading: true, error: null });
    try {
      const principal = await authService.login();
      if (principal) {
        set({ 
          isAuthenticated: true, 
          principal,
          isLoading: false 
        });
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          isLoading: false,
          error: 'Login failed' 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      set({ 
        isAuthenticated: false,
        principal: null,
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
      // 開発環境では認証をスキップ
      if (__DEV__) {
        console.log('Development mode: Skipping authentication');
        set({ 
          isAuthenticated: true, 
          principal: Principal.fromText('2vxsx-fae'),
          isLoading: false 
        });
        return;
      }

      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        const principal = await authService.getPrincipal();
        set({ 
          isAuthenticated: true, 
          principal,
          isLoading: false 
        });
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // 開発環境でエラーが発生した場合も認証済みとして扱う
      if (__DEV__) {
        set({ 
          isAuthenticated: true,
          principal: Principal.fromText('2vxsx-fae'),
          isLoading: false 
        });
      } else {
        set({ 
          isAuthenticated: false,
          principal: null,
          isLoading: false 
        });
      }
    }
  },
}));