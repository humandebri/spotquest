import React, { useEffect, useState } from 'react';
import Button from './Button';

export const PWAUpdatePrompt: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Listen for service worker update events
    const handleServiceWorkerUpdate = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg);
      setShowUpdate(true);
    };

    // Set up the update handler
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                handleServiceWorkerUpdate(reg);
              }
            });
          }
        });
      });

      // Listen for skip waiting message
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SKIP_WAITING') {
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell SW to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowUpdate(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    // Show again after 1 hour
    setTimeout(() => {
      if (registration?.waiting) {
        setShowUpdate(true);
      }
    }, 3600000);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 z-50">
      <h3 className="text-lg font-semibold text-white mb-2">
        アップデートがあります
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        新しいバージョンが利用可能です。更新してより良い体験をお楽しみください。
      </p>
      <div className="flex gap-2">
        <Button 
          onClick={handleUpdate} 
          variant="primary" 
          size="small"
          className="flex-1"
        >
          今すぐ更新
        </Button>
        <Button 
          onClick={handleDismiss} 
          variant="secondary" 
          size="small"
          className="flex-1"
        >
          後で
        </Button>
      </div>
    </div>
  );
};