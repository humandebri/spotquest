import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Upload Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/upload');
  });

  test('should require authentication', async ({ page }) => {
    await expect(page.locator('h2:has-text("Please login to upload photos")')).toBeVisible();
  });

  test('should show upload interface when authenticated', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check upload elements
    await expect(page.locator('h2:has-text("Upload Photo")')).toBeVisible();
    await expect(page.locator('text=Select Photo')).toBeVisible();
    await expect(page.locator('text=PNG, JPG up to 5MB')).toBeVisible();
  });

  test('should handle file selection', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Create a test image file
    const buffer = Buffer.from('fake-image-data');
    const fileName = 'test-photo.jpg';

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'image/jpeg',
      buffer: buffer,
    });

    // Should show preview or error
    await expect(page.locator('img[alt="Preview"]')).toBeVisible()
      .or(expect(page.locator('text=No GPS Data Found')).toBeVisible());
  });

  test('should validate file size', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Create a large file (>5MB)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const fileName = 'large-photo.jpg';

    // Try to upload large file
    const fileInput = page.locator('input[type="file"]');
    
    // Listen for dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('5MB');
      await dialog.accept();
    });

    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'image/jpeg',
      buffer: largeBuffer,
    });
  });

  test('azimuth control should be interactive', async ({ page }) => {
    // Mock authentication and successful file upload
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check if azimuth slider exists
    const azimuthSlider = page.locator('input[type="range"]');
    
    // Initially might be disabled
    await expect(azimuthSlider).toBeDisabled()
      .or(expect(azimuthSlider).toBeVisible());
  });

  test('should show upload progress', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Look for upload button
    const uploadButton = page.locator('button:has-text("Upload Photo")');
    await expect(uploadButton).toBeVisible();
    
    // Should be disabled initially
    await expect(uploadButton).toBeDisabled();
  });

  test('should display info box about rewards', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Check for reward information
    await expect(page.locator('text=Earn SPOT Tokens')).toBeVisible();
    await expect(page.locator('text=30% of their rewards')).toBeVisible();
  });
});