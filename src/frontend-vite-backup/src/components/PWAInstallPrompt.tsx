import React, { useEffect, useState } from 'react';
import Button from './Button';
import Modal from './Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds or on the 3rd visit
      const visitCount = parseInt(localStorage.getItem('visitCount') || '0') + 1;
      localStorage.setItem('visitCount', visitCount.toString());
      
      if (visitCount >= 3) {
        setTimeout(() => setShowPrompt(true), 2000);
      } else {
        setTimeout(() => setShowPrompt(true), 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS && isSafari && !isInstalled) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS Safari instructions
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setIsInstalled(true);
      }
    } catch (error) {
      console.error('Error during installation:', error);
    } finally {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwaDismissed', Date.now().toString());
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissedTime = localStorage.getItem('pwaDismissed');
    if (dismissedTime) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (!showPrompt || isInstalled) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <Modal isOpen={showPrompt} onClose={handleDismiss} title="アプリをインストール">
      <div className="space-y-4">
        <p className="text-gray-300">
          Guess the Spotをホーム画面に追加して、より快適にプレイしましょう！
        </p>
        
        <div className="space-y-2 text-sm text-gray-400">
          <p>✓ オフラインでも一部機能が利用可能</p>
          <p>✓ プッシュ通知でゲーム情報を受け取る</p>
          <p>✓ より高速な起動と操作</p>
        </div>

        {isIOS && !deferredPrompt ? (
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-sm text-gray-300 mb-2">iOSでのインストール方法:</p>
            <ol className="text-sm text-gray-400 space-y-1">
              <li>1. Safari下部の共有ボタン <span className="text-blue-400">⬆</span> をタップ</li>
              <li>2. 「ホーム画面に追加」を選択</li>
              <li>3. 「追加」をタップ</li>
            </ol>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button onClick={handleInstall} variant="primary" className="flex-1">
              インストール
            </Button>
            <Button onClick={handleDismiss} variant="secondary" className="flex-1">
              後で
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};