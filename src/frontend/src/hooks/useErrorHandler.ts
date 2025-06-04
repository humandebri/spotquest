import { useCallback } from 'react';
import { ApiError } from '../types';

export const useErrorHandler = () => {
  const handleError = useCallback((error: unknown): ApiError => {
    console.error('Error occurred:', error);
    
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR'
      };
    }
    
    if (typeof error === 'string') {
      return {
        message: error,
        code: 'STRING_ERROR'
      };
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        message: String(error.message),
        code: 'code' in error ? String(error.code) : undefined
      };
    }
    
    return {
      message: 'An unexpected error occurred',
      code: 'UNEXPECTED_ERROR'
    };
  }, []);

  const showErrorNotification = useCallback((error: ApiError) => {
    // In production, this would show a toast notification
    console.error(`Error: ${error.message} (${error.code})`);
    
    // For now, just alert
    if (typeof window !== 'undefined') {
      alert(error.message);
    }
  }, []);

  return {
    handleError,
    showErrorNotification
  };
};