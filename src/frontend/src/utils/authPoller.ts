// Polling mechanism to check for authentication completion
// This is a workaround for when deep links don't work properly in Expo Go
import { DEBUG_CONFIG, debugLog } from './debugConfig';

export class AuthPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private onAuthSuccess: () => void;
  private checkAuth: () => Promise<boolean>;
  
  constructor(checkAuth: () => Promise<boolean>, onAuthSuccess: () => void) {
    this.checkAuth = checkAuth;
    this.onAuthSuccess = onAuthSuccess;
  }
  
  start() {
    debugLog('AUTH_FLOW', '🔄 Starting auth polling...');
    
    // Poll every 2 seconds
    this.intervalId = setInterval(async () => {
      try {
        const isAuthenticated = await this.checkAuth();
        if (isAuthenticated) {
          debugLog('AUTH_FLOW', '✅ Auth polling: Authentication detected!');
          this.stop();
          this.onAuthSuccess();
        }
      } catch (error) {
        debugLog('AUTH_FLOW', '🔄 Auth polling error:', error);
      }
    }, 2000);
    
    // Auto-stop after 2 minutes
    setTimeout(() => {
      if (this.intervalId) {
        debugLog('AUTH_FLOW', '⏰ Auth polling timeout');
        this.stop();
      }
    }, 120000);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      debugLog('AUTH_FLOW', '🔄 Auth polling stopped');
    }
  }
}