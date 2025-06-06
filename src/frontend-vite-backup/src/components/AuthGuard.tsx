import React from 'react';
import { useAuthStore } from '../store/authStore';
import EmptyState from './EmptyState';
import LoadingSpinner from './LoadingSpinner';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export default function AuthGuard({ 
  children, 
  fallback,
  loadingComponent 
}: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <>
        {loadingComponent || (
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        )}
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {fallback || (
          <EmptyState
            icon={
              <svg
                className="w-full h-full"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            }
            title="Authentication Required"
            description="You need to connect your Internet Identity to access this feature."
            action={{
              label: 'Connect Wallet',
              onClick: () => useAuthStore.getState().login()
            }}
          />
        )}
      </>
    );
  }

  return <>{children}</>;
}