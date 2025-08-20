import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { AuthContextType, AuthState, IIAuthConfig } from '../types/auth';

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

    // TODO: Implement Internet Identity login
    dispatch({
      type: 'SET_ERROR',
      payload: 'Internet Identity service not configured'
    });
    return false;
  };

  // Logout function
  const logout = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_UNAUTHENTICATED' });
  };

  // Check authentication status
  const checkAuth = async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_UNAUTHENTICATED' });
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