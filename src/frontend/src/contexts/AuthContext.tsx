import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Identity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import { AuthContextType, AuthState, IIAuthConfig } from '../types/auth';
import { internetIdentityService } from '../services/internetIdentity';

// 管理者のPrincipal IDリスト
const ADMIN_PRINCIPALS = [
  '4wbqy-noqfb-3dunk-64f7k-4v54w-kzvti-l24ky-jaz3f-73y36-gegjt-cqe',
  '2vxsx-fae', // Development test principal
];

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  principal: null,
  identity: null,
  error: null,
  isAdmin: false,
};

// Action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: { principal: Principal; identity: Identity | null; isAdmin: boolean } }
  | { type: 'SET_UNAUTHENTICATED' }
  | { type: 'CLEAR_ERROR' };

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_AUTHENTICATED':
      return {
        ...state,
        isAuthenticated: true,
        principal: action.payload.principal,
        identity: action.payload.identity,
        isAdmin: action.payload.isAdmin,
        isLoading: false,
        error: null,
      };
    case 'SET_UNAUTHENTICATED':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check if principal is admin
  const checkIsAdmin = (principal: Principal): boolean => {
    return ADMIN_PRINCIPALS.includes(principal.toString());
  };

  // Login function
  const login = async (config?: IIAuthConfig): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const result = await internetIdentityService.login(config);
      
      if (result.success) {
        const principal = await internetIdentityService.getPrincipal();
        const identity = await internetIdentityService.getIdentity();
        
        if (principal) {
          const isAdmin = checkIsAdmin(principal);
          dispatch({
            type: 'SET_AUTHENTICATED',
            payload: { principal, identity, isAdmin }
          });
          return true;
        } else {
          dispatch({
            type: 'SET_ERROR',
            payload: 'Failed to retrieve user principal'
          });
          return false;
        }
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: result.error || 'Authentication failed'
        });
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Login failed'
      });
      return false;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await internetIdentityService.logout();
      dispatch({ type: 'SET_UNAUTHENTICATED' });
    } catch (error) {
      console.error('Logout error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Logout failed'
      });
    }
  };

  // Check authentication status
  const checkAuth = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const isAuthenticated = await internetIdentityService.isAuthenticated();
      
      if (isAuthenticated) {
        const principal = await internetIdentityService.getPrincipal();
        const identity = await internetIdentityService.getIdentity();
        
        if (principal) {
          const isAdmin = checkIsAdmin(principal);
          dispatch({
            type: 'SET_AUTHENTICATED',
            payload: { principal, identity, isAdmin }
          });
        } else {
          dispatch({ type: 'SET_UNAUTHENTICATED' });
        }
      } else {
        dispatch({ type: 'SET_UNAUTHENTICATED' });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      dispatch({ type: 'SET_UNAUTHENTICATED' });
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Initialize authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    checkAuth,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for checking admin status
export function useIsAdmin(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin;
}