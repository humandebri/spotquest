// Auth hook wrapper to easily switch between different auth implementations
import { useIIAuthStore } from '../store/iiAuthStore';
import { useIIIntegrationContext } from 'expo-ii-integration';

export function useAuth() {
  const store = useIIAuthStore();
  const iiContext = useIIIntegrationContext();

  return {
    // State from store
    isAuthenticated: store.isAuthenticated,
    principal: store.principal,
    identity: store.identity,
    isLoading: store.isLoading || !iiContext.isAuthReady,
    error: store.error || iiContext.authError,
    isAdmin: store.isAdmin,
    
    // Methods
    login: iiContext.login,
    logout: iiContext.logout,
    checkAuth: async () => {
      // For II integration, auth state is automatically managed
      // This is kept for compatibility
    },
    checkIsAdmin: store.checkIsAdmin,
    clearError: () => {
      store.setError(null);
      iiContext.clearAuthError();
    },
  };
}

// Export the store for direct access if needed
export { useIIAuthStore as useAuthStore } from '../store/iiAuthStore';