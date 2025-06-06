import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const { 
    isAuthenticated, 
    principal, 
    loading, 
    login, 
    logout 
  } = useAuthStore();

  return {
    isAuthenticated,
    principal,
    loading,
    login,
    logout,
    principalId: principal?.toString() || null,
    shortPrincipalId: principal ? `${principal.toString().slice(0, 8)}...` : null
  };
};