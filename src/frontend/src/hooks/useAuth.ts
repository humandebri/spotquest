// Auth hook using expo-ii-integration directly
import React from 'react';
import { useIIIntegrationContext } from 'expo-ii-integration';
import { ADMIN_PRINCIPALS } from '../constants';

export function useAuth() {
  const iiIntegration = useIIIntegrationContext();
  
  // Calculate isAdmin based on principal
  const isAdmin = React.useMemo(() => {
    if (!iiIntegration.isAuthenticated || !iiIntegration.principal) {
      return false;
    }
    return ADMIN_PRINCIPALS.includes(iiIntegration.principal.toString());
  }, [iiIntegration.isAuthenticated, iiIntegration.principal]);

  // Wrap login function to provide default parameters
  const login = React.useCallback(async () => {
    return iiIntegration.login({
      redirectPath: 'auth',  // Add the missing redirectPath parameter
    });
  }, [iiIntegration.login]);

  return {
    // State from expo-ii-integration
    isAuthenticated: iiIntegration.isAuthenticated,
    principal: iiIntegration.principal,
    identity: iiIntegration.identity,
    isLoading: !iiIntegration.isAuthReady,
    error: iiIntegration.authError ? String(iiIntegration.authError) : null,
    isAdmin,
    
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