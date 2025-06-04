import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { useAuthStore } from '../store/authStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'ii' | 'plug' | null>(null);

  const handleLogin = async (provider: 'ii' | 'plug') => {
    setSelectedProvider(provider);
    setIsLoading(true);
    
    try {
      await login(provider);
      onClose();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
      setSelectedProvider(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Wallet"
      size="small"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose your preferred authentication method to access Guess the Spot.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleLogin('ii')}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">II</span>
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Internet Identity</h3>
                <p className="text-sm text-gray-500">Secure, private authentication</p>
              </div>
            </div>
            {isLoading && selectedProvider === 'ii' && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            )}
          </button>

          <button
            onClick={() => handleLogin('plug')}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Plug Wallet</h3>
                <p className="text-sm text-gray-500">Browser extension wallet</p>
              </div>
            </div>
            {isLoading && selectedProvider === 'plug' && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            )}
          </button>
        </div>

        <div className="text-xs text-gray-500 text-center">
          By connecting, you agree to our Terms of Service and Privacy Policy.
        </div>
      </div>
    </Modal>
  );
}