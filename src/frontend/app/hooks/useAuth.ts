// Auth hook using expo-ii-integration directly
import React from 'react';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { useIIAuthStore } from '../store/iiAuthStore';
import { useDevAuth } from '../contexts/DevAuthContext';
import { ADMIN_PRINCIPALS } from '../constants/index';
import { DEBUG_CONFIG, debugLog, debugError } from '../utils/debugConfig';

export function useAuth() {
  const iiIntegration = useIIIntegrationContext();
  const { isDevMode } = useDevAuth();
  const { 
    setAuthenticated, 
    setUnauthenticated, 
    setError,
    isAuthenticated: storeAuthenticated,
    principal: storePrincipal,
    identity: storeIdentity,
    isAdmin: storeIsAdmin 
  } = useIIAuthStore();
  
  // Sync authentication state with store when II integration state changes
  React.useEffect(() => {
    debugLog('AUTH_FLOW', '🔍 Auth state changed:', {
      isAuthenticated: iiIntegration.isAuthenticated,
      isAuthReady: iiIntegration.isAuthReady,
      authError: iiIntegration.authError,
      storeAuthenticated,
      isDevMode
    });
    
    // Also check for delegation data
    if ((iiIntegration as any).getDelegation) {
      (iiIntegration as any).getDelegation().then((delegation: any) => {
        debugLog('AUTH_FLOW', '🔍 Current delegation:', delegation ? 'Present' : 'None');
      }).catch((err: any) => {
        debugLog('AUTH_FLOW', '🔍 Error getting delegation:', err);
      });
    }
    
    // If authenticated but error is "Invalid delegations", it might be a false positive
    if (iiIntegration.isAuthenticated && iiIntegration.authError?.toString().includes('Invalid delegations')) {
      debugLog('AUTH_FLOW', '🔍 Authenticated but delegation invalid - likely a bug');
    }
    
    const syncAuthState = async () => {
      if (iiIntegration.isAuthenticated && iiIntegration.isAuthReady) {
        try {
          debugLog('AUTH_FLOW', '🔍 Getting identity...');
          const identity = await iiIntegration.getIdentity();
          if (identity) {
            const principal = identity.getPrincipal();
            setAuthenticated(principal, identity);
            debugLog('AUTH_FLOW', '✅ Auth synced - Principal:', principal.toString());
          } else {
            debugLog('AUTH_FLOW', '❌ Identity is null');
          }
        } catch (error) {
          debugError('AUTH_FLOW', '❌ Failed to get identity:', error);
          setError('Failed to retrieve identity');
        }
      } else if (!iiIntegration.isAuthenticated && iiIntegration.isAuthReady) {
        debugLog('AUTH_FLOW', '🔍 User not authenticated, setting unauthenticated state');
        setUnauthenticated();
      }
    };

    if (iiIntegration.isAuthReady && !isDevMode) {
      // If store is already authenticated (e.g., via Google), don't override with II state
      if (storeAuthenticated) {
        debugLog('AUTH_FLOW', '🔍 Store already authenticated; skipping II sync');
      } else {
        syncAuthState();
      }
    }
  }, [iiIntegration.isAuthenticated, iiIntegration.isAuthReady, storeAuthenticated, isDevMode]);

  // Handle auth errors
  React.useEffect(() => {
    if (iiIntegration.authError) {
      const errorMessage = iiIntegration.authError instanceof Error 
        ? iiIntegration.authError.message 
        : 'Authentication failed';
      setError(errorMessage);
    }
  }, [iiIntegration.authError]);
  
  // Calculate isAdmin based on principal (use store values)
  const isAdmin = React.useMemo(() => {
    if (!storeAuthenticated || !storePrincipal) {
      return false;
    }
    return ADMIN_PRINCIPALS.includes(storePrincipal.toString());
  }, [storeAuthenticated, storePrincipal]);

  // Wrap login function to provide default parameters  
  const login = React.useCallback(async () => {
    debugLog('AUTH_FLOW', '🔍 Login called with redirectPath: auth');
    debugLog('AUTH_FLOW', '🔍 II Integration state:', {
      isAuthenticated: iiIntegration.isAuthenticated,
      isAuthReady: iiIntegration.isAuthReady,
      authError: iiIntegration.authError
    });
    
    try {
      const result = await iiIntegration.login({
        redirectPath: 'auth',
      });
      debugLog('AUTH_FLOW', '🔍 Login result:', result);
      
      // Force session check after login
      setTimeout(async () => {
        debugLog('AUTH_FLOW', '🔍 Forcing session check...');
        try {
          const identity = await iiIntegration.getIdentity();
          if (identity) {
            debugLog('AUTH_FLOW', '✅ Identity retrieved after login');
          }
        } catch (e) {
          debugLog('AUTH_FLOW', '❌ Failed to get identity after login:', e);
        }
      }, 5000);
      
      return result;
    } catch (error) {
      debugError('AUTH_FLOW', '🔍 Login error:', error);
      throw error;
    }
  }, [iiIntegration.login]);

  const isLoadingComputed = React.useMemo(() => {
    if (storeAuthenticated) return false;
    return isDevMode ? false : !iiIntegration.isAuthReady;
  }, [storeAuthenticated, isDevMode, iiIntegration.isAuthReady]);

  return {
    // State from store (properly synced)
    isAuthenticated: storeAuthenticated,
    principal: storePrincipal,
    identity: storeIdentity,
    isLoading: isLoadingComputed,
    error: isDevMode ? null : (iiIntegration.authError ? String(iiIntegration.authError) : null),
    isAdmin,
    isDevMode,
    
    // Methods from expo-ii-integration
    login,
    logout: iiIntegration.logout,
    checkAuth: async () => {
      // expo-ii-integration manages auth state automatically
    },
    checkIsAdmin: () => isAdmin,
    clearError: iiIntegration.clearAuthError || (() => {}),
  };
}
