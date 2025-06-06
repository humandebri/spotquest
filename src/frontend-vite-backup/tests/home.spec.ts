import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Guess the location');
    await expect(page.locator('h1')).toContainText('earn SPOT tokens');
  });

  test('should show login button when not authenticated', async ({ page }) => {
    const loginButton = page.locator('button:has-text("Login with Internet Identity")');
    await expect(loginButton).toBeVisible();
  });

  test('should display how it works section', async ({ page }) => {
    await expect(page.locator('h2:has-text("How it works")')).toBeVisible();
    await expect(page.locator('text=Play Rounds')).toBeVisible();
    await expect(page.locator('text=Upload Photos')).toBeVisible();
    await expect(page.locator('text=Earn SPOT')).toBeVisible();
  });

  test('should navigate to different pages', async ({ page }) => {
    // Click on Play link
    await page.click('a[href="/game"]');
    await expect(page).toHaveURL('/game');

    // Click on Upload link
    await page.click('a[href="/upload"]');
    await expect(page).toHaveURL('/upload');

    // Click on Leaderboard link
    await page.click('a[href="/leaderboard"]');
    await expect(page).toHaveURL('/leaderboard');
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();
  });
});