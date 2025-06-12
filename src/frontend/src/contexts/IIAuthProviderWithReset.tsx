import React, { ReactNode } from 'react';
import { IIAuthProvider } from './IIAuthContext';
import { IIErrorBoundary } from '../components/IIErrorBoundary';

interface IIAuthProviderWithResetProps {
  children: ReactNode;
}

export function IIAuthProviderWithReset({ children }: IIAuthProviderWithResetProps) {
  return (
    <IIErrorBoundary>
      <IIAuthProvider>
        {children}
      </IIAuthProvider>
    </IIErrorBoundary>
  );
}