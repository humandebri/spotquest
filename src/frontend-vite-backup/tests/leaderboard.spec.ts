import { test, expect } from '@playwright/test';

test.describe('Leaderboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
  });

  test('should display leaderboard header', async ({ page }) => {
    await expect(page.locator('h2:has-text("Leaderboard")')).toBeVisible();
  });

  test('should have player and photo tabs', async ({ page }) => {
    const playerTab = page.locator('button:has-text("Top Players")');
    const photoTab = page.locator('button:has-text("Top Photos")');
    
    await expect(playerTab).toBeVisible();
    await expect(photoTab).toBeVisible();
    
    // Player tab should be active by default
    await expect(playerTab).toHaveClass(/border-primary-500/);
  });

  test('should switch between tabs', async ({ page }) => {
    const playerTab = page.locator('button:has-text("Top Players")');
    const photoTab = page.locator('button:has-text("Top Photos")');
    
    // Click photo tab
    await photoTab.click();
    await expect(photoTab).toHaveClass(/border-primary-500/);
    await expect(playerTab).not.toHaveClass(/border-primary-500/);
    
    // Switch back to player tab
    await playerTab.click();
    await expect(playerTab).toHaveClass(/border-primary-500/);
    await expect(photoTab).not.toHaveClass(/border-primary-500/);
  });

  test('should display player leaderboard table', async ({ page }) => {
    // Check table headers
    await expect(page.locator('th:has-text("Rank")')).toBeVisible();
    await expect(page.locator('th:has-text("Player")')).toBeVisible();
    await expect(page.locator('th:has-text("Total Score")')).toBeVisible();
    await expect(page.locator('th:has-text("Rounds Played")')).toBeVisible();
    await expect(page.locator('th:has-text("Avg Score")')).toBeVisible();
    await expect(page.locator('th:has-text("SPOT Earned")')).toBeVisible();
  });

  test('should display photo leaderboard when tab clicked', async ({ page }) => {
    // Click photo tab
    await page.click('button:has-text("Top Photos")');
    
    // Check table headers
    await expect(page.locator('th:has-text("Photo ID")')).toBeVisible();
    await expect(page.locator('th:has-text("Owner")')).toBeVisible();
    await expect(page.locator('th:has-text("Times Played")')).toBeVisible();
    await expect(page.locator('th:has-text("Quality Score")')).toBeVisible();
    await expect(page.locator('th:has-text("SPOT Earned")')).toBeVisible();
  });

  test('should display statistics summary', async ({ page }) => {
    await expect(page.locator('text=Total Players')).toBeVisible();
    await expect(page.locator('text=Total Rounds')).toBeVisible();
    await expect(page.locator('text=SPOT Distributed')).toBeVisible();
  });

  test('should handle loading state', async ({ page }) => {
    // Slow down network to see loading state
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 1000);
    });
    
    await page.reload();
    
    // Should show loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Table should still be visible (might scroll horizontally)
    await expect(page.locator('table')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('table')).toBeVisible();
  });

  test('quality score should have visual indicator', async ({ page }) => {
    // Click photo tab
    await page.click('button:has-text("Top Photos")');
    
    // Look for quality score bars
    const qualityBars = page.locator('.bg-green-600, .bg-yellow-600, .bg-red-600');
    
    // Should have at least one quality indicator
    const count = await qualityBars.count();
    expect(count).toBeGreaterThan(0);
  });
});