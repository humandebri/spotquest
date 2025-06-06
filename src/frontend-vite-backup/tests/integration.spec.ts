import { test, expect } from '@playwright/test';

test.describe('Full User Journey', () => {
  test('complete game flow from login to play', async ({ page }) => {
    // 1. Start at home page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Guess the location');
    
    // 2. Try to play without login
    await page.click('a[href="/game"]');
    await expect(page.locator('text=Please login to play')).toBeVisible();
    
    // 3. Mock login
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          authenticated: true,
          principal: 'test-user-principal'
        }),
      });
    });
    
    // 4. Go back to home and navigate to game
    await page.goto('/');
    await page.click('a[href="/game"]');
    
    // 5. Should see game interface
    await expect(page.locator('text=No Active Round')).toBeVisible();
    
    // 6. Check leaderboard
    await page.click('a[href="/leaderboard"]');
    await expect(page.locator('h2:has-text("Leaderboard")')).toBeVisible();
    
    // 7. Check profile
    await page.click('a[href="/profile"]');
    await expect(page.locator('text=Principal ID')).toBeVisible();
    
    // 8. Try upload flow
    await page.click('a[href="/upload"]');
    await expect(page.locator('h2:has-text("Upload Photo")')).toBeVisible();
  });

  test('mobile navigation flow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Navigate through all pages
    const pages = ['/game', '/upload', '/leaderboard', '/profile'];
    
    for (const path of pages) {
      await page.click(`a[href="${path}"]`);
      await expect(page).toHaveURL(path);
      await page.waitForTimeout(500); // Small delay for mobile
    }
  });

  test('error handling and recovery', async ({ page }) => {
    await page.goto('/');
    
    // Simulate network error
    await page.route('**/*', route => {
      if (route.request().url().includes('api')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Try to navigate to game
    await page.click('a[href="/game"]');
    
    // Should still render page (even if data fails)
    await expect(page).toHaveURL('/game');
  });

  test('form validation flow', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });
    
    await page.goto('/upload');
    
    // Try to upload without file
    const uploadButton = page.locator('button:has-text("Upload Photo")');
    await expect(uploadButton).toBeDisabled();
    
    // Select a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });
    
    // Button might still be disabled if no GPS data
    await expect(uploadButton).toBeDisabled()
      .or(expect(page.locator('text=No GPS Data')).toBeVisible());
  });

  test('responsive design check', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1920, height: 1080, name: 'Desktop' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      
      // Check that navigation is visible
      await expect(page.locator('nav')).toBeVisible();
      
      // Check that main content adapts
      await expect(page.locator('h1')).toBeVisible();
      
      // Take screenshot for visual regression
      await page.screenshot({ 
        path: `test-results/home-${viewport.name}.png`,
        fullPage: true 
      });
    }
  });

  test('keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Press Enter on focused element
    await page.keyboard.press('Enter');
    
    // Should navigate to a new page
    expect(page.url()).not.toBe('/');
  });

  test('accessibility check', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
    }
    
    // Check for proper button labels
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const text = await buttons.nth(i).textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });
});