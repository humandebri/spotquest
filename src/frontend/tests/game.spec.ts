import { test, expect } from '@playwright/test';

test.describe('Game Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/game');
  });

  test('should require authentication', async ({ page }) => {
    await expect(page.locator('h2:has-text("Please login to play")')).toBeVisible();
  });

  test('should show game interface when authenticated', async ({ page }) => {
    // Mock authentication by intercepting auth checks
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    // Reload page after mocking auth
    await page.reload();

    // Check for game elements
    await expect(page.locator('text=No Active Round')).toBeVisible();
    await expect(page.locator('button:has-text("Start New Round")')).toBeVisible();
  });

  test('map should be interactive', async ({ page }) => {
    // Check if map container exists
    const mapContainer = page.locator('.mapboxgl-map');
    await expect(mapContainer).toBeVisible();

    // Simulate map click
    await mapContainer.click({ position: { x: 200, y: 200 } });

    // Check if azimuth control is visible
    await expect(page.locator('label:has-text("Compass Direction")')).toBeVisible();
  });

  test('should handle round creation', async ({ page }) => {
    // Mock authentication
    await page.route('**/api/v2/status', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ authenticated: true }),
      });
    });

    await page.reload();

    // Click start new round
    const startButton = page.locator('button:has-text("Start New Round")');
    await startButton.click();

    // Should show loading or error state
    await expect(page.locator('text=Loading')).toBeVisible()
      .or(expect(page.locator('text=Failed')).toBeVisible());
  });

  test('azimuth slider should work', async ({ page }) => {
    const slider = page.locator('input[type="range"]');
    
    // Check if slider exists
    await expect(slider).toBeVisible();

    // Change slider value
    await slider.fill('180');
    
    // Check if value is updated
    await expect(page.locator('text=180°')).toBeVisible();
  });
});