import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Principal } from '@dfinity/principal';
import { Identity } from '@dfinity/agent';
import { directAuthService } from '../services/directAuth';

interface DirectAuthContextType {
  isAuthenticated: boolean;
  isAuthReady: boolean;
  principal: Principal | null;
  identity: Identity | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const DirectAuthContext = createContext<DirectAuthContextType | null>(null);

export function DirectAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize auth service
    const init = async () => {
      try {
        await directAuthService.init();
        
        // Check authentication status
        const authenticated = await directAuthService.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (authenticated) {
          const id = await directAuthService.getIdentity();
          if (id) {
            setIdentity(id);
            setPrincipal(id.getPrincipal());
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize auth');
      } finally {
        setIsAuthReady(true);
      }
    };

    init();
  }, []);

  const login = async () => {
    setError(null);
    try {
      console.log('🔍 Starting direct authentication...');
      await directAuthService.login();
      
      // After successful login, update state
      const authenticated = await directAuthService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const id = await directAuthService.getIdentity();
        if (id) {
          setIdentity(id);
          setPrincipal(id.getPrincipal());
          console.log('✅ Direct auth successful, principal:', id.getPrincipal().toString());
        }
      }
    } catch (err) {
      console.error('❌ Direct auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await directAuthService.logout();
      setIsAuthenticated(false);
      setPrincipal(null);
      setIdentity(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  return (
    <DirectAuthContext.Provider
      value={{
        isAuthenticated,
        isAuthReady,
        principal,
        identity,
        login,
        logout,
        error,
      }}
    >
      {children}
    </DirectAuthContext.Provider>
  );
}

export function useDirectAuth() {
  const context = useContext(DirectAuthContext);
  if (!context) {
    throw new Error('useDirectAuth must be used within DirectAuthProvider');
  }
  return context;
}