import { create } from 'zustand';
import { Principal } from '@dfinity/principal';
import type { Identity } from '@dfinity/agent';
import { ADMIN_PRINCIPALS } from '../constants/index';
import { DEBUG_CONFIG, debugLog } from '../utils/debugConfig';

interface IIAuthState {
  isAuthenticated: boolean;
  principal: Principal | null;
  identity: Identity | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  
  setAuthenticated: (principal: Principal, identity: Identity) => void;
  setUnauthenticated: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkIsAdmin: () => boolean;
}

export const useIIAuthStore = create<IIAuthState>((set, get) => ({
  isAuthenticated: false,
  principal: null,
  identity: null,
  isLoading: false,
  error: null,
  isAdmin: false,

  setAuthenticated: (principal: Principal, identity: Identity) => {
    const isAdmin = ADMIN_PRINCIPALS.includes(principal.toString());
    debugLog('AUTH_FLOW', '🔧 Auth store: Setting authenticated', {
      principal: principal.toString(),
      isAdmin,
      adminPrincipals: ADMIN_PRINCIPALS
    });
    set({ 
      isAuthenticated: true, 
      principal,
      identity,
      isAdmin,
      isLoading: false,
      error: null
    });
  },

  setUnauthenticated: () => {
    set({ 
      isAuthenticated: false, 
      principal: null,
      identity: null,
      isAdmin: false,
      isLoading: false,
      error: null
    });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error, isLoading: false });
  },

  checkIsAdmin: () => {
    const state = get();
    return state.isAdmin;
  },
}));