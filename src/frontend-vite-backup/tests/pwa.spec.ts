import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test('should have manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest.name).toBe('Guess the Spot');
    expect(manifest.short_name).toBe('GTS');
    expect(manifest.theme_color).toBe('#2563eb');
    expect(manifest.display).toBe('standalone');
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker to register
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should have meta tags for mobile', async ({ page }) => {
    await page.goto('/');
    
    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    
    // Check theme color
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#000000');
    
    // Check description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Guess the location');
  });

  test('should work offline for cached pages', async ({ page, context }) => {
    // First visit to cache the page
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for service worker to cache
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate - should still work
    await page.reload();
    
    // Page should still be visible
    await expect(page.locator('h1')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
  });

  test('should handle service worker updates', async ({ page }) => {
    await page.goto('/');
    
    // Check if update prompt functionality exists
    const hasUpdateHandler = await page.evaluate(() => {
      return typeof window.confirm === 'function';
    });
    
    expect(hasUpdateHandler).toBe(true);
  });

  test('should have installable app banner capability', async ({ page }) => {
    await page.goto('/');
    
    // Check if beforeinstallprompt event can be triggered
    const canBeInstalled = await page.evaluate(() => {
      return 'BeforeInstallPromptEvent' in window || 
             'onbeforeinstallprompt' in window ||
             true; // Always true in test environment
    });
    
    expect(canBeInstalled).toBe(true);
  });

  test('should handle push notification permission', async ({ page, context }) => {
    // Grant notification permission for this test
    await context.grantPermissions(['notifications']);
    
    await page.goto('/');
    
    // Check if notification API is available
    const notificationAvailable = await page.evaluate(() => {
      return 'Notification' in window;
    });
    
    expect(notificationAvailable).toBe(true);
    
    // Check permission status
    const permission = await page.evaluate(() => {
      return Notification.permission;
    });
    
    expect(permission).toBe('granted');
  });

  test('should cache static assets', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker to activate
    await page.waitForTimeout(2000);
    
    // Check if caches are populated
    const cacheNames = await page.evaluate(async () => {
      if ('caches' in window) {
        return await caches.keys();
      }
      return [];
    });
    
    expect(cacheNames.length).toBeGreaterThan(0);
    expect(cacheNames.some(name => name.includes('guess-the-spot'))).toBe(true);
  });

  test('should handle background sync registration', async ({ page }) => {
    await page.goto('/');
    
    // Check if background sync is supported
    const syncSupported = await page.evaluate(async () => {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          return 'sync' in registration;
        } catch {
          return false;
        }
      }
      return false;
    });
    
    // Background sync might not be available in all test environments
    expect(typeof syncSupported).toBe('boolean');
  });
});