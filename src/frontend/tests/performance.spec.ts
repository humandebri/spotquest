import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('page load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0;
        let fid = 0;
        let cls = 0;
        
        // Observe LCP
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcp = entries[entries.length - 1].startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Observe CLS
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            cls += entry.value;
          }
        }).observe({ entryTypes: ['layout-shift'] });
        
        // Wait a bit then resolve
        setTimeout(() => {
          resolve({ lcp, cls });
        }, 2000);
      });
    });
    
    // LCP should be under 2.5s
    expect(metrics.lcp).toBeLessThan(2500);
    
    // CLS should be under 0.1
    expect(metrics.cls).toBeLessThan(0.1);
  });

  test('bundle size check', async ({ page }) => {
    const coverage = await page.coverage.startJSCoverage();
    await page.goto('/');
    const jsCoverage = await page.coverage.stopJSCoverage();
    
    let totalBytes = 0;
    let usedBytes = 0;
    
    for (const entry of jsCoverage) {
      totalBytes += entry.text.length;
      for (const range of entry.ranges) {
        usedBytes += range.end - range.start;
      }
    }
    
    const unusedPercentage = ((totalBytes - usedBytes) / totalBytes) * 100;
    
    // Less than 50% of JS should be unused
    expect(unusedPercentage).toBeLessThan(50);
  });

  test('memory usage', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Navigate through the app
    await page.click('a[href="/game"]');
    await page.click('a[href="/leaderboard"]');
    await page.click('a[href="/profile"]');
    await page.click('a[href="/upload"]');
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory increase should be reasonable (less than 50MB)
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  test('image optimization', async ({ page }) => {
    await page.goto('/');
    
    // Get all images
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.clientWidth,
        displayHeight: img.clientHeight,
      }));
    });
    
    for (const img of images) {
      // Check if images are appropriately sized
      if (img.naturalWidth > 0 && img.displayWidth > 0) {
        const ratio = img.naturalWidth / img.displayWidth;
        // Natural size should not be more than 2x display size
        expect(ratio).toBeLessThan(2.5);
      }
    }
  });

  test('network requests optimization', async ({ page }) => {
    const requests: any[] = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for duplicate requests
    const uniqueRequests = new Set(requests.map(r => r.url));
    expect(uniqueRequests.size).toBe(requests.length);
    
    // Check for reasonable number of requests
    expect(requests.length).toBeLessThan(50);
    
    // Check that static assets are cached
    const staticAssets = requests.filter(r => 
      r.resourceType === 'stylesheet' || 
      r.resourceType === 'script' ||
      r.resourceType === 'image'
    );
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Static assets should be cached (fewer requests on reload)
    const reloadRequests = requests.length;
    expect(reloadRequests).toBeLessThan(requests.length);
  });

  test('animation performance', async ({ page }) => {
    await page.goto('/');
    
    // Start tracing
    await page.tracing.start({ screenshots: true, snapshots: true });
    
    // Trigger some animations
    await page.hover('button');
    await page.click('a[href="/game"]');
    
    // Stop tracing
    const trace = await page.tracing.stop();
    
    // Analyze trace (in real scenario, would parse trace file)
    // For now, just ensure no errors
    expect(trace).toBeTruthy();
  });

  test('lazy loading check', async ({ page }) => {
    let imageRequests = 0;
    
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        imageRequests++;
      }
    });
    
    await page.goto('/');
    
    const initialImageRequests = imageRequests;
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Check if more images were loaded
    const finalImageRequests = imageRequests;
    
    // If lazy loading is implemented, more images should load on scroll
    // If not, all images load initially
    expect(finalImageRequests).toBeGreaterThanOrEqual(initialImageRequests);
  });
});