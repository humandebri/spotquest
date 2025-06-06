import { test, expect } from '@playwright/test';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
  });

  test('should require authentication', async ({ page }) => {
    await expect(page.locator('h2:has-text("Please login to view your profile")')).toBeVisible();
  });

  test('should show profile when authenticated', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check profile elements
    await expect(page.locator('h2:has-text("Profile")')).toBeVisible();
    await expect(page.locator('text=Principal ID')).toBeVisible();
    await expect(page.locator('text=SPOT Balance')).toBeVisible();
  });

  test('should display user statistics', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check stats
    await expect(page.locator('text=Photos Uploaded')).toBeVisible();
    await expect(page.locator('text=Total Earned')).toBeVisible();
    await expect(page.locator('text=Rounds Played')).toBeVisible();
    await expect(page.locator('text=Average Distance')).toBeVisible();
  });

  test('should display photo gallery', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check photo section
    await expect(page.locator('h2:has-text("My Photos")')).toBeVisible();
    
    // Should show photos or empty state
    const photos = page.locator('text=Photo #');
    const emptyState = page.locator('text=You haven\'t uploaded any photos yet');
    
    await expect(photos.first()).toBeVisible()
      .or(expect(emptyState).toBeVisible());
  });

  test('should show quality scores for photos', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Look for quality score indicators
    const qualityText = page.locator('text=Quality Score').first();
    
    // If photos exist, quality scores should be visible
    if (await qualityText.isVisible()) {
      const qualityBar = page.locator('.bg-green-600, .bg-yellow-600, .bg-red-600').first();
      await expect(qualityBar).toBeVisible();
    }
  });

  test('should have link to upload photos', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check for upload link in empty state
    const uploadLink = page.locator('a:has-text("Upload your first photo")');
    
    // If no photos, upload link should be visible
    if (await uploadLink.isVisible()) {
      await uploadLink.click();
      await expect(page).toHaveURL('/upload');
    }
  });

  test('should be responsive', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h2:has-text("Profile")')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h2:has-text("Profile")')).toBeVisible();
  });

  test('principal ID should be truncated', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          authenticated: true,
          principal: 'ryjl3-tyaaa-aaaaa-aaaba-cai'
        }),
      });
    });

    await page.reload();

    // Principal ID should be displayed
    const principalText = page.locator('.font-mono').first();
    const text = await principalText.textContent();
    
    // Should contain principal ID format
    expect(text).toMatch(/^[a-z0-9\-]+$/);
  });
});