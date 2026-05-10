import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for BugDrop
 * Tests run against wrangler dev server at http://localhost:8787
 */

test.describe('Widget Loading', () => {
  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('BugDrop')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Filter out expected widget errors (missing repo in some test scenarios)
    const unexpectedErrors = errors.filter(e => !e.includes('Missing data-repo'));
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('widget host element exists', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Widget creates a host element
    const host = page.locator('#bugdrop-host');
    await expect(host).toBeAttached();
  });

  test('feedback button is visible in shadow DOM', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Access button inside shadow DOM
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible();
  });
});

test.describe('Widget Interaction', () => {
  test('clicking feedback button triggers modal', async ({ page }) => {
    await page.goto('/test/');

    // Wait for widget to be ready
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    // Click the trigger button
    await button.click();

    // Modal should appear (or installation prompt if not installed)
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('element picker handles SVG elements without errors', async ({ page }) => {
    // Track console errors - specifically looking for className.split errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Mock the installation check to return installed: true
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    // Wait for widget to be ready
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    // Click the trigger button to open modal
    await button.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // New flow: Click "Get Started" on welcome screen
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Fill in the feedback form and check "Include screenshot"
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test feedback for SVG');

    const screenshotCheckbox = page.locator('#bugdrop-host').locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    // Click Continue to proceed to screenshot options
    const continueBtn = page.locator('#bugdrop-host').locator('css=#submit-btn');
    await continueBtn.click();

    // Click "Select Element" option
    const selectElementBtn = page.locator('#bugdrop-host').locator('css=[data-action="element"]');
    await expect(selectElementBtn).toBeVisible({ timeout: 5000 });
    await selectElementBtn.click();

    // Wait for element picker mode to be active
    await page.waitForTimeout(300);

    // Click on the SVG element - this previously caused className.split error
    const svgElement = page.locator('#test-svg');
    await expect(svgElement).toBeVisible();
    await svgElement.click();

    // Check for the className.split error that was previously occurring
    const classNameErrors = errors.filter(
      e => e.includes('className.split') || e.includes('split is not a function')
    );

    expect(classNameErrors).toHaveLength(0);

    // Annotation canvas should appear (indicating flow continued successfully to annotation step)
    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 5000 });
  });

  test('element picker handles nested SVG child elements without errors', async ({ page }) => {
    // Track console errors - the fix must handle nested SVG elements too
    // since getElementSelector walks up the DOM tree
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Mock the installation check to return installed: true
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    // Wait for widget to be ready
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    // Click the trigger button to open modal
    await button.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // New flow: Click "Get Started" on welcome screen
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Fill in the feedback form and check "Include screenshot"
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test feedback for nested SVG');

    const screenshotCheckbox = page.locator('#bugdrop-host').locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    // Click Continue to proceed to screenshot options
    const continueBtn = page.locator('#bugdrop-host').locator('css=#submit-btn');
    await continueBtn.click();

    // Click "Select Element" option
    const selectElementBtn = page.locator('#bugdrop-host').locator('css=[data-action="element"]');
    await expect(selectElementBtn).toBeVisible({ timeout: 5000 });
    await selectElementBtn.click();

    // Wait for element picker mode to be active
    await page.waitForTimeout(300);

    // Click on nested SVG child element (text inside SVG)
    // This tests that getElementSelector handles SVG elements when walking up the tree
    const svgText = page.locator('#test-svg text');
    await expect(svgText).toBeVisible();
    await svgText.click();

    // Check for the className.split error
    const classNameErrors = errors.filter(
      e => e.includes('className.split') || e.includes('split is not a function')
    );

    expect(classNameErrors).toHaveLength(0);

    // Annotation canvas should appear
    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 5000 });
  });

  test('welcome screen only shows once per repo (default behavior)', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    // Clear welcome-seen state for this repo
    await page.evaluate(() =>
      localStorage.removeItem('bugdrop_welcomed_neonwatty/feedback-widget-test')
    );
    await page.reload();

    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    // First open: welcome should appear
    await button.click();
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Form should appear
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Close the modal
    const cancelBtn = page.locator('#bugdrop-host').locator('css=[data-action="cancel"]');
    await cancelBtn.click();
    const overlay = page.locator('#bugdrop-host').locator('css=.bd-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 5000 });

    // Second open: welcome should be skipped, form appears directly
    await button.click();
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Verify "Get Started" button is NOT present (welcome was skipped)
    await expect(getStartedBtn).not.toBeVisible();
  });

  test('data-welcome="false" skips welcome entirely', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/welcome-disabled.html');

    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    await button.click();

    // Form should appear directly, no welcome screen
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Welcome "Get Started" button should NOT be present
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).not.toBeVisible();
  });

  test('data-welcome="always" shows welcome every time', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/welcome-always.html');

    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });

    // First open: welcome should appear
    await button.click();
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Form should appear
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Close the modal and wait for it to disappear
    const cancelBtn = page.locator('#bugdrop-host').locator('css=[data-action="cancel"]');
    await cancelBtn.click();
    const overlay = page.locator('#bugdrop-host').locator('css=.bd-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 5000 });

    // Second open: welcome should appear AGAIN (always mode)
    await button.click();
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
  });

  test('BugDrop.open() skips welcome screen', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    // Wait for BugDrop API to be available, then open programmatically
    await page.waitForFunction(() => typeof (window as any).BugDrop !== 'undefined', {
      timeout: 5000,
    });
    await page.evaluate(() => {
      (window as any).BugDrop?.open();
    });

    // Form should appear directly (no welcome screen)
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Welcome "Get Started" button should NOT be present
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).not.toBeVisible();
  });

  test('screenshot checkbox is checked by default', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    // Click through welcome
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Verify screenshot checkbox is checked by default
    const screenshotCheckbox = page.locator('#bugdrop-host').locator('css=#include-screenshot');
    await expect(screenshotCheckbox).toBeChecked();
  });

  test('version number appears on welcome screen but not on form', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    const host = page.locator('#bugdrop-host');
    const button = host.locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    // Version should appear on the welcome screen
    const versionEl = host.locator('css=.bd-version');
    await expect(versionEl).toBeVisible({ timeout: 5000 });
    const versionText = await versionEl.textContent();
    expect(versionText).toMatch(/^BugDrop v/);

    // Advance to feedback form
    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await getStartedBtn.click();

    // Version should NOT appear on the form screen
    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(versionEl).not.toBeVisible();
  });

  test('select area button appears and launches area picker overlay', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    const host = page.locator('#bugdrop-host');
    const button = host.locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    // Click through welcome screen
    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Fill required title field and ensure screenshot checkbox is checked
    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test bug report');

    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    const submitBtn = host.locator('css=#submit-btn');
    await submitBtn.click();

    // Verify "Select Area" button appears in screenshot options
    const areaBtn = host.locator('css=[data-action="area"]');
    await expect(areaBtn).toBeVisible({ timeout: 5000 });

    // Click Select Area
    await areaBtn.click();

    // Area picker overlay should appear on the page (outside shadow DOM)
    const overlay = page.locator('#bugdrop-area-picker-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Tooltip should be visible
    const tooltip = page.locator('#bugdrop-area-picker-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('Draw a selection around the area to capture (ESC to cancel)');
    await expect(tooltip).not.toContainText('Drag');

    // Press ESC to cancel
    await page.keyboard.press('Escape');

    // Overlay should be removed
    await expect(overlay).not.toBeVisible({ timeout: 3000 });
  });

  test('screenshot options prioritize capture actions before skip', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/test/');

    const host = page.locator('#bugdrop-host');
    const button = host.locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test screenshot hierarchy');

    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    const submitBtn = host.locator('css=#submit-btn');
    await submitBtn.click();

    const actions = host.locator('css=.bd-screenshot-actions [data-action]');
    await expect(actions).toHaveCount(4);

    const actionOrder = await actions.evaluateAll(buttons =>
      buttons.map(button => (button as HTMLElement).dataset.action)
    );
    expect(actionOrder).toEqual(['capture', 'area', 'element', 'skip']);

    await expect(host.locator('css=[data-action="capture"]')).toHaveClass(/bd-btn-primary/);
    await expect(host.locator('css=[data-action="skip"]')).toHaveClass(/bd-btn-quiet/);

    const verticalPositions = await actions.evaluateAll(buttons =>
      buttons.map(button => Math.round((button as HTMLElement).getBoundingClientRect().top))
    );
    expect(verticalPositions).toEqual([...verticalPositions].sort((a, b) => a - b));
  });

  test('retake button on annotation step returns to screenshot options', async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/');

    const host = page.locator('#bugdrop-host');
    const button = host.locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    // Click through welcome
    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Fill form and submit with screenshot
    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test retake');

    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    const submitBtn = host.locator('css=#submit-btn');
    await submitBtn.click();

    // Click "Full Page" to capture
    const fullPageBtn = host.locator('css=[data-action="capture"]');
    await expect(fullPageBtn).toBeVisible({ timeout: 5000 });
    await fullPageBtn.click();

    // Wait for annotation step to appear (screenshot capture can take several seconds)
    const retakeBtn = host.locator('css=[data-action="retake"]');
    await expect(retakeBtn).toBeVisible({ timeout: 15000 });

    // Click Retake
    await retakeBtn.click();

    // Should be back at screenshot options
    await expect(fullPageBtn).toBeVisible({ timeout: 5000 });

    // All 4 screenshot options should be available
    const skipBtn = host.locator('css=[data-action="skip"]');
    const elementBtn = host.locator('css=[data-action="element"]');
    const areaBtn = host.locator('css=[data-action="area"]');
    await expect(skipBtn).toBeVisible();
    await expect(elementBtn).toBeVisible();
    await expect(areaBtn).toBeVisible();
  });
});

test.describe('API Endpoints', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.environment).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  test('health endpoint has CORS headers', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['access-control-allow-origin']).toBe('*');
  });

  test('feedback endpoint validates required fields', async ({ request }) => {
    // Missing repo
    const res1 = await request.post('/api/feedback', {
      data: { title: 'Test', description: 'Test' },
    });
    expect(res1.status()).toBe(400);

    // Missing title
    const res2 = await request.post('/api/feedback', {
      data: { repo: 'owner/repo', description: 'Test' },
    });
    expect(res2.status()).toBe(400);

    // Missing description (optional — should not return 400)
    const res3 = await request.post('/api/feedback', {
      data: { repo: 'owner/repo', title: 'Test' },
    });
    expect(res3.status()).not.toBe(400);
  });

  test('feedback endpoint rejects invalid repo format', async ({ request }) => {
    const response = await request.post('/api/feedback', {
      data: {
        repo: 'invalid-format',
        title: 'Test',
        description: 'Test',
        metadata: {
          url: 'http://test.com',
          userAgent: 'test',
          viewport: { width: 1920, height: 1080 },
          timestamp: new Date().toISOString(),
        },
      },
    });
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid repo format');
  });
});

test.describe('Dismissible Button', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
  });

  test('close icon appears on hover when dismissible is enabled', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Close button should exist but be hidden initially
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toBeAttached();

    // Check that close button has opacity 0 initially (hidden)
    const initialOpacity = await closeBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(initialOpacity)).toBeLessThan(0.5);

    // Hover over the trigger button
    await trigger.hover();

    // Wait for transition and check opacity is now 1 (visible)
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    const hoverOpacity = await closeBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(hoverOpacity)).toBeGreaterThan(0.5);
  });

  test('clicking close icon hides the button', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover to reveal close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Click the close button
    await closeBtn.click();

    // Trigger should no longer exist
    await expect(trigger).not.toBeAttached();
  });

  test('clicking close icon does not open feedback modal', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover to reveal close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Click the close button
    await closeBtn.click();

    // Modal should not appear
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).not.toBeVisible();
  });

  test('button stays hidden after page reload (localStorage persistence)', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover and click close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Verify button is gone
    await expect(trigger).not.toBeAttached();

    // Reload the page
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Button should still be hidden
    const triggerAfterReload = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterReload).not.toBeAttached();
  });

  test('button appears normally when dismissible is not enabled', async ({ page }) => {
    // Use the regular test page (no dismissible attribute)
    await page.goto('/test/');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Close button should NOT exist
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).not.toBeAttached();
  });

  test('localStorage dismissed state is ignored when dismissible is false', async ({ page }) => {
    // Set localStorage as if button was dismissed
    await page.goto('/test/');
    await page.evaluate(() => localStorage.setItem('bugdrop_dismissed', 'true'));

    // Reload page (regular test page without dismissible)
    await page.reload();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should still be visible because dismissible is not enabled
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });
  });

  // === Edge Case Tests ===

  test('dismissible button works in light theme', async ({ page }) => {
    await page.goto('/test/dismissible-light.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Close button should exist
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toBeAttached();

    // Hover to reveal close button
    await trigger.hover();
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Verify close button is visible
    const hoverOpacity = await closeBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(hoverOpacity)).toBeGreaterThan(0.5);

    // Click close and verify dismiss works
    await closeBtn.click();
    await expect(trigger).not.toBeAttached();

    // Verify persistence
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });
    await expect(page.locator('#bugdrop-host').locator('css=.bd-trigger')).not.toBeAttached();
  });

  test('dismissible button works with bottom-left position', async ({ page }) => {
    await page.goto('/test/dismissible-left.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Verify button is on the left side
    const buttonBox = await trigger.boundingBox();
    expect(buttonBox).not.toBeNull();
    if (buttonBox) {
      // Button should be closer to left edge than right edge
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(buttonBox.x).toBeLessThan(viewportWidth / 2);
    }

    // Close button should exist and work
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toBeAttached();

    // Hover and dismiss
    await trigger.hover();
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached();
  });

  test('close icon is always visible on touch devices', async ({ browser }) => {
    // Create a context with touch device emulation
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 }, // iPhone 14 Pro dimensions
    });
    const page = await context.newPage();

    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toBeAttached();

    // On touch devices, close button should be visible without hover
    // due to @media (hover: none) CSS rule
    const opacity = await closeBtn.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBe(1);

    // Tap to dismiss should work
    await closeBtn.tap();
    await expect(trigger).not.toBeAttached();

    await context.close();
  });

  test('keyboard accessibility - dismiss with Enter key', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover to reveal close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Focus the close button and press Enter
    await closeBtn.focus();
    await page.keyboard.press('Enter');

    // Button should be dismissed
    await expect(trigger).not.toBeAttached();
  });

  test('keyboard accessibility - dismiss with Space key', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover to reveal close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Focus the close button and press Space
    await closeBtn.focus();
    await page.keyboard.press('Space');

    // Button should be dismissed
    await expect(trigger).not.toBeAttached();
  });

  test('close icon changes to red/error color on direct hover', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');

    // Hover over trigger first to reveal close button
    await trigger.hover();
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Get initial background color
    const initialBg = await closeBtn.evaluate(el => getComputedStyle(el).backgroundColor);

    // Now hover directly on close button
    await closeBtn.hover();
    await page.waitForTimeout(100);

    // Get hovered background color
    const hoveredBg = await closeBtn.evaluate(el => getComputedStyle(el).backgroundColor);

    // Colors should be different (close button turns red on hover)
    expect(hoveredBg).not.toBe(initialBg);

    // Verify it's a reddish color (error color)
    // Parse RGB and check red channel is dominant
    const rgbMatch = hoveredBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      expect(r).toBeGreaterThan(200); // High red
      expect(r).toBeGreaterThan(g); // Red > Green
      expect(r).toBeGreaterThan(b); // Red > Blue
    }
  });

  test('localStorage key is set correctly on dismiss (timestamp format)', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Verify localStorage is empty before dismiss
    const beforeDismiss = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(beforeDismiss).toBeNull();

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Verify localStorage key is set to a timestamp (number)
    const afterDismiss = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(afterDismiss).not.toBeNull();
    const timestamp = parseInt(afterDismiss!, 10);
    expect(isNaN(timestamp)).toBe(false);
    // Timestamp should be recent (within last minute)
    expect(Date.now() - timestamp).toBeLessThan(60000);

    // Verify only our key was set (no other bugdrop keys)
    const allKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.includes('bugdrop'))
    );
    expect(allKeys).toEqual(['bugdrop_dismissed']);
  });

  test('legacy "true" localStorage value still works (permanent dismiss)', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    // Set legacy 'true' value
    await page.evaluate(() => localStorage.setItem('bugdrop_dismissed', 'true'));
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Button should be hidden
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).not.toBeAttached();
  });

  test('BugDrop.show() brings back dismissed button', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Verify button is gone
    await expect(trigger).not.toBeAttached();

    // Verify localStorage is set
    const dismissed = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(dismissed).not.toBeNull();

    // Call BugDrop.show() to bring button back
    await page.evaluate(() => window.BugDrop?.show());
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should be visible again
    const triggerAfterShow = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterShow).toBeVisible();

    // localStorage should be cleared
    const dismissedAfterShow = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(dismissedAfterShow).toBeNull();
  });

  test('BugDrop.show() works even after page reload when dismissed', async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached();

    // Reload the page - button should still be hidden
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });
    const triggerAfterReload = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterReload).not.toBeAttached();

    // Call BugDrop.show() to bring button back
    await page.evaluate(() => window.BugDrop?.show());
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should be visible
    const triggerAfterShow = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterShow).toBeVisible();
  });

  test('clearing localStorage restores the button', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    // First dismiss the button
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached();

    // Now clear localStorage and reload
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should be visible again
    const triggerRestored = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerRestored).toBeVisible({ timeout: 5000 });
  });

  test('widget handles localStorage errors gracefully', async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));

    // Override localStorage to throw errors
    await page.evaluate(() => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      const _originalGetItem = localStorage.getItem.bind(localStorage);

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => {
            throw new Error('localStorage blocked');
          },
          setItem: () => {
            throw new Error('localStorage blocked');
          },
          removeItem: originalSetItem,
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
      });
    });

    // Reload with broken localStorage
    await page.reload();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Widget should still load (graceful degradation)
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss should still work visually (even if not persisted)
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Button should be hidden
    await expect(trigger).not.toBeAttached();

    // No uncaught errors related to localStorage
    const localStorageErrors = errors.filter(e => e.includes('localStorage'));
    expect(localStorageErrors).toHaveLength(0);
  });

  test('rapid double-click on close button does not cause errors', async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Hover to reveal close button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });

    // Click the close button
    await closeBtn.click();

    // Button should be removed (pull tab should appear instead)
    await expect(trigger).not.toBeAttached();

    // Pull tab should be visible
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeAttached();

    // No errors should occur
    expect(errors).toHaveLength(0);
  });
});

test.describe('Dismiss Duration', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/test/dismissible-duration.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
  });

  test('button reappears when dismiss duration has passed', async ({ page }) => {
    await page.goto('/test/dismissible-duration.html');

    // Set an old timestamp (8 days ago, duration is 7 days)
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate(
      ts => localStorage.setItem('bugdrop_dismissed', ts.toString()),
      eightDaysAgo
    );

    // Reload the page
    await page.reload();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should be visible again (8 days > 7 day duration)
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });
  });

  test('button stays hidden when dismiss duration has not passed', async ({ page }) => {
    await page.goto('/test/dismissible-duration.html');

    // Set a recent timestamp (3 days ago, duration is 7 days)
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await page.evaluate(
      ts => localStorage.setItem('bugdrop_dismissed', ts.toString()),
      threeDaysAgo
    );

    // Reload the page
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Button should still be hidden (3 days < 7 day duration)
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).not.toBeAttached();
  });

  test('button hidden immediately after dismissing', async ({ page }) => {
    await page.goto('/test/dismissible-duration.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
    await page.reload();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Button should be hidden
    await expect(trigger).not.toBeAttached();

    // Reload and verify still hidden
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });
    const triggerAfterReload = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterReload).not.toBeAttached();
  });

  test('dismiss duration is ignored when button is not dismissible', async ({ page }) => {
    // Use regular test page (no dismissible flag)
    await page.goto('/test/');

    // Set an old timestamp
    const oldTimestamp = Date.now() - 100 * 24 * 60 * 60 * 1000;
    await page.evaluate(
      ts => localStorage.setItem('bugdrop_dismissed', ts.toString()),
      oldTimestamp
    );
    await page.reload();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Button should be visible because dismissible is not enabled
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Keyboard Event Isolation', () => {
  test('typing in widget inputs does not leak keystrokes to host page', async ({ page }) => {
    // Mock the installation check so the feedback form loads
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/keyboard-conflict.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Track host-page keydown events that fire while BugDrop is open
    await page.evaluate(() => {
      (window as any).__hostKeystrokeCount = 0;
      document.addEventListener('keydown', () => {
        if (document.getElementById('bugdrop-host')) {
          (window as any).__hostKeystrokeCount++;
        }
      });
    });

    // Open the widget
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Skip welcome screen if present
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    if (await getStartedBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await getStartedBtn.click();
    }

    // Type into the title INPUT using real keyboard events
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.click();
    await page.keyboard.type('Test keystroke isolation');

    // Type into the description TEXTAREA
    const descInput = page.locator('#bugdrop-host').locator('css=#description');
    await expect(descInput).toBeVisible({ timeout: 5000 });
    await descInput.click();
    await page.keyboard.type('Also testing textarea');

    // Verify text was actually entered (stopPropagation must not swallow input events)
    await expect(titleInput).toHaveValue('Test keystroke isolation');
    await expect(descInput).toHaveValue('Also testing textarea');

    // Host page should NOT have received any keystrokes
    const leakedCount = await page.evaluate(() => (window as any).__hostKeystrokeCount);
    expect(leakedCount).toBe(0);
  });
});

test.describe('Install URL from appName', () => {
  test('uses server-provided appName in install link', async ({ page }) => {
    // Mock /check to return installed: false with a custom appName
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: false, appName: 'my-custom-app' }),
      });
    });

    await page.goto('/test/keyboard-conflict.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Open the widget
    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The install prompt should contain a link using the server-provided appName
    const installLink = page.locator('#bugdrop-host').locator('css=a.bd-btn-primary');
    await expect(installLink).toBeVisible({ timeout: 5000 });
    await expect(installLink).toHaveAttribute(
      'href',
      'https://github.com/apps/my-custom-app/installations/new'
    );
  });

  test('falls back to URL-derived appName when server omits it', async ({ page }) => {
    // Mock /check to return installed: false without appName
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: false }),
      });
    });

    await page.goto('/test/keyboard-conflict.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const button = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Should still show an install link using the fallback-derived name
    const installLink = page.locator('#bugdrop-host').locator('css=a.bd-btn-primary');
    await expect(installLink).toBeVisible({ timeout: 5000 });
    const href = await installLink.getAttribute('href');
    expect(href).toMatch(/^https:\/\/github\.com\/apps\/.+\/installations\/new$/);
    // Should NOT contain the custom app name (proving fallback was used)
    expect(href).not.toContain('my-custom-app');
  });
});

test.describe('Widget Build', () => {
  test('widget.js is accessible', async ({ request }) => {
    const response = await request.get('/widget.js');
    expect(response.ok()).toBeTruthy();

    const content = await response.text();
    expect(content).toContain('use strict');
  });

  test('widget.js is an IIFE bundle', async ({ request }) => {
    const response = await request.get('/widget.js');
    const content = await response.text();

    // IIFE pattern starts with (()=>{ or similar
    expect(content).toMatch(/^\s*["']use strict["'];?\s*\(\s*\(\s*\)\s*=>\s*\{/);
  });

  test('versioned widget files are accessible', async ({ request }) => {
    // Read versions.json to get the actual versioned filenames
    const versionsResp = await request.get('/versions.json');
    expect(versionsResp.ok()).toBeTruthy();

    const manifest = await versionsResp.json();
    const versionedFiles = Object.values(manifest.versions) as string[];

    for (const filename of versionedFiles) {
      const response = await request.get(`/${filename}`);
      expect(response.ok(), `${filename} should be accessible`).toBeTruthy();
    }
  });

  test('versioned widget files contain identical content to widget.js', async ({ request }) => {
    const baseResp = await request.get('/widget.js');
    const baseContent = await baseResp.text();

    const versionsResp = await request.get('/versions.json');
    const manifest = await versionsResp.json();
    const versionedFiles = Object.values(manifest.versions) as string[];

    for (const filename of versionedFiles) {
      const response = await request.get(`/${filename}`);
      const content = await response.text();
      expect(content, `${filename} should match widget.js`).toBe(baseContent);
    }
  });
});

test.describe('JavaScript API', () => {
  test('window.BugDrop exists after widget loads', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const hasBugDrop = await page.evaluate(() => {
      return typeof window.BugDrop === 'object' && window.BugDrop !== null;
    });
    expect(hasBugDrop).toBeTruthy();
  });

  test('BugDrop API has all expected methods', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const apiMethods = await page.evaluate(() => {
      if (!window.BugDrop) return [];
      return Object.keys(window.BugDrop);
    });

    expect(apiMethods).toContain('open');
    expect(apiMethods).toContain('close');
    expect(apiMethods).toContain('hide');
    expect(apiMethods).toContain('show');
    expect(apiMethods).toContain('isOpen');
    expect(apiMethods).toContain('isButtonVisible');
  });

  test('bugdrop:ready event fires after initialization', async ({ page }) => {
    // Use the api-only test page which sets up a listener for the event
    await page.goto('/test/api-only.html');

    // Wait for the status to update (indicating bugdrop:ready was received)
    await page.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('BugDrop ready');
      },
      { timeout: 5000 }
    );

    // Verify the event was received
    const statusText = await page.locator('#status').textContent();
    expect(statusText).toContain('BugDrop ready');
  });

  test('BugDrop.open() opens the modal', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Modal should not be visible initially
    const modalBefore = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modalBefore).not.toBeVisible();

    // Call open API
    await page.evaluate(() => window.BugDrop?.open());
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    // Modal should now be visible
    const modalAfter = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modalAfter).toBeVisible();
  });

  test('BugDrop.close() closes the modal', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Open modal first
    await page.evaluate(() => window.BugDrop?.open());
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible();

    // Close via API
    await page.evaluate(() => window.BugDrop?.close());
    await expect(page.locator('#bugdrop-host').locator('css=.bd-modal')).not.toBeVisible();

    // Modal should be gone
    await expect(modal).not.toBeVisible();
  });

  test('BugDrop.isOpen() returns correct state', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Should be false initially
    const isOpenBefore = await page.evaluate(() => window.BugDrop?.isOpen());
    expect(isOpenBefore).toBeFalsy();

    // Open modal
    await page.evaluate(() => window.BugDrop?.open());
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    // Should be true now
    const isOpenAfter = await page.evaluate(() => window.BugDrop?.isOpen());
    expect(isOpenAfter).toBeTruthy();

    // Close modal
    await page.evaluate(() => window.BugDrop?.close());
    await expect(page.locator('#bugdrop-host').locator('css=.bd-modal')).not.toBeVisible();

    // Should be false again
    const isOpenFinal = await page.evaluate(() => window.BugDrop?.isOpen());
    expect(isOpenFinal).toBeFalsy();
  });

  test('BugDrop.hide() hides the floating button', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible();

    // Hide button
    await page.evaluate(() => window.BugDrop?.hide());

    // Button should be hidden
    await expect(trigger).not.toBeVisible();
  });

  test('BugDrop.show() shows the hidden button', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');

    // Hide then show
    await page.evaluate(() => window.BugDrop?.hide());
    await expect(trigger).not.toBeVisible();

    await page.evaluate(() => window.BugDrop?.show());
    await expect(trigger).toBeVisible();
  });

  test('BugDrop.isButtonVisible() returns correct state', async ({ page }) => {
    await page.goto('/test/');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Should be true initially
    const isVisibleBefore = await page.evaluate(() => window.BugDrop?.isButtonVisible());
    expect(isVisibleBefore).toBeTruthy();

    // Hide button
    await page.evaluate(() => window.BugDrop?.hide());

    // Should be false now
    const isVisibleAfter = await page.evaluate(() => window.BugDrop?.isButtonVisible());
    expect(isVisibleAfter).toBeFalsy();

    // Show button
    await page.evaluate(() => window.BugDrop?.show());

    // Should be true again
    const isVisibleFinal = await page.evaluate(() => window.BugDrop?.isButtonVisible());
    expect(isVisibleFinal).toBeTruthy();
  });
});

test.describe('Custom Accent Color', () => {
  test('default color is teal when data-color is not set', async ({ page }) => {
    await page.goto('/test/color-default.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Get the background color of the button
    const bgColor = await trigger.evaluate(el => getComputedStyle(el).backgroundColor);

    // Default dark theme color is #22d3ee (rgb(34, 211, 238))
    // Parse RGB values
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(rgbMatch).not.toBeNull();

    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      // Teal/cyan has high green and blue, low red
      expect(r).toBeLessThan(100); // Low red
      expect(g).toBeGreaterThan(150); // High green
      expect(b).toBeGreaterThan(200); // High blue
    }
  });

  test('custom color is applied when data-color is set', async ({ page }) => {
    await page.goto('/test/color-custom.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Get the background color of the button
    const bgColor = await trigger.evaluate(el => getComputedStyle(el).backgroundColor);

    // Custom color is #9333EA (purple) = rgb(147, 51, 234)
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(rgbMatch).not.toBeNull();

    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      // Purple has medium red, low green, high blue
      expect(r).toBeGreaterThan(100); // Medium-high red
      expect(g).toBeLessThan(100); // Low green
      expect(b).toBeGreaterThan(200); // High blue
    }
  });

  test('custom color applies to focus ring on form inputs', async ({ page }) => {
    // Mock the installation check to return installed: true
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/color-custom.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Open modal
    await trigger.click();

    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click "Get Started" on welcome screen
    const getStartedBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    // Focus on title input
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.focus();

    // Check that the --bd-border-focus CSS variable is set to the custom color
    const root = page.locator('#bugdrop-host').locator('css=.bd-root');
    const borderFocusColor = await root.evaluate(el =>
      getComputedStyle(el).getPropertyValue('--bd-border-focus').trim()
    );

    // Should be the custom purple color
    expect(borderFocusColor).toBe('#9333EA');
  });

  test('custom color persists after modal interactions', async ({ page }) => {
    await page.goto('/test/color-custom.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Open and close modal
    await trigger.click();
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-close');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // Button should still have custom color
    const bgColor = await trigger.evaluate(el => getComputedStyle(el).backgroundColor);
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    expect(rgbMatch).not.toBeNull();

    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      // Still purple
      expect(r).toBeGreaterThan(100);
      expect(g).toBeLessThan(100);
      expect(b).toBeGreaterThan(200);
    }
  });
});

test.describe('Pull Tab Restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/dismissible.html');
    await page.evaluate(() => localStorage.removeItem('bugdrop_dismissed'));
  });

  test('pull tab appears after dismissing the button', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Pull tab should not exist initially
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).not.toBeAttached();

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Pull tab should now be visible
    await expect(pullTab).toBeVisible({ timeout: 2000 });
  });

  test('clicking pull tab restores the feedback button', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Click the pull tab
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible({ timeout: 2000 });
    await pullTab.click();

    // Button should be visible again
    const triggerAfterRestore = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterRestore).toBeVisible({ timeout: 2000 });

    // Pull tab should be gone
    await expect(pullTab).not.toBeAttached();
  });

  test('pull tab restore clears localStorage dismissed state', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached({ timeout: 2000 });

    // Verify localStorage is set
    const dismissedBefore = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(dismissedBefore).not.toBeNull();

    // Click the pull tab
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible({ timeout: 2000 });
    await pullTab.click();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // localStorage should be cleared
    const dismissedAfter = await page.evaluate(() => localStorage.getItem('bugdrop_dismissed'));
    expect(dismissedAfter).toBeNull();
  });

  test('restored button is fully functional', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss and restore
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached({ timeout: 2000 });

    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible({ timeout: 2000 });
    await pullTab.click();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Click the restored button to open modal
    const restoredTrigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await restoredTrigger.click();

    // Modal should open
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('restored button can be dismissed again', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // First dismiss
    await trigger.hover();
    let closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached({ timeout: 2000 });

    // Restore via pull tab
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible({ timeout: 2000 });
    await pullTab.click();
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Second dismiss
    const restoredTrigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await restoredTrigger.hover();
    closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();

    // Button should be gone, pull tab should reappear
    await expect(restoredTrigger).not.toBeAttached({ timeout: 5000 });
    const pullTabAgain = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTabAgain).toBeVisible({ timeout: 2000 });
  });

  test('pull tab is keyboard accessible', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached({ timeout: 2000 });

    // Focus the pull tab and press Enter
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible({ timeout: 2000 });
    await pullTab.focus();
    await page.keyboard.press('Enter');

    // Button should be restored
    const restoredTrigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(restoredTrigger).toBeVisible({ timeout: 2000 });
  });

  test('pull tab persists after page reload', async ({ page }) => {
    await page.goto('/test/dismissible.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Dismiss the button
    await trigger.hover();
    const closeBtn = page.locator('#bugdrop-host').locator('css=.bd-trigger-close');
    await expect(closeBtn).toHaveCSS('opacity', '1', { timeout: 2000 });
    await closeBtn.click();
    await expect(trigger).not.toBeAttached({ timeout: 2000 });

    // Reload page
    await page.reload();
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Button should still be hidden
    const triggerAfterReload = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(triggerAfterReload).not.toBeAttached();

    // Pull tab should be visible
    const pullTab = page.locator('#bugdrop-host').locator('css=.bd-pull-tab');
    await expect(pullTab).toBeVisible();
  });
});

test.describe('API-Only Mode (data-button="false")', () => {
  test('floating button is not rendered when data-button="false"', async ({ page }) => {
    await page.goto('/test/api-only.html');
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Button should not exist
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).not.toBeAttached();
  });

  test('BugDrop API is still available in API-only mode', async ({ page }) => {
    await page.goto('/test/api-only.html');
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    const hasBugDrop = await page.evaluate(() => {
      return typeof window.BugDrop === 'object' && window.BugDrop !== null;
    });
    expect(hasBugDrop).toBeTruthy();
  });

  test('BugDrop.open() works in API-only mode', async ({ page }) => {
    await page.goto('/test/api-only.html');
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Open modal via API
    await page.evaluate(() => window.BugDrop?.open());
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    // Modal should be visible
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible();
  });

  test('BugDrop.isButtonVisible() returns false in API-only mode', async ({ page }) => {
    await page.goto('/test/api-only.html');
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    const isVisible = await page.evaluate(() => window.BugDrop?.isButtonVisible());
    expect(isVisible).toBeFalsy();
  });

  test('custom button can trigger BugDrop.open()', async ({ page }) => {
    await page.goto('/test/api-only.html');

    // Wait for BugDrop to be ready
    await page.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status?.textContent?.includes('BugDrop ready');
      },
      { timeout: 5000 }
    );

    // Click the "Report Bug" link in the nav
    await page.click('#nav-report-bug');

    // Modal should open
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('BugDrop.show() does nothing in API-only mode (no button to show)', async ({ page }) => {
    await page.goto('/test/api-only.html');
    await page.locator('#bugdrop-host').waitFor({ state: 'attached' });

    // Try to show button (should do nothing, no errors)
    await page.evaluate(() => window.BugDrop?.show());

    // Button should still not exist
    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).not.toBeAttached();
  });
});

test.describe('Feedback Categories', () => {
  test('category selector is visible on feedback form', async ({ page }) => {
    // Mock installation check
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/index.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Click to open modal
    await trigger.click();
    const modal = page.locator('#bugdrop-host').locator('css=.bd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click continue on welcome screen
    const continueBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await continueBtn.click();

    // Wait for form to appear by checking for title input
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Category selector should be visible
    const categorySelector = page.locator('#bugdrop-host').locator('css=.bd-category-selector');
    await expect(categorySelector).toBeVisible();

    // All three options should be present
    const bugOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="bug"]');
    const featureOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="feature"]');
    const questionOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="question"]');

    await expect(bugOption).toBeAttached();
    await expect(featureOption).toBeAttached();
    await expect(questionOption).toBeAttached();
  });

  test('feedback form fields progress from category to details and submitter info', async ({
    page,
  }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/test/?showName=true&showEmail=true');

    const host = page.locator('#bugdrop-host');
    await host.locator('css=.bd-trigger').click();
    await host.locator('css=[data-action="continue"]').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });

    const fieldOrder = await host.locator('css=#feedback-form').evaluate(form =>
      Array.from(form.children)
        .map(child => {
          if (!(child instanceof HTMLElement)) return null;
          if (child.querySelector('.bd-category-selector')) return 'category';
          if (child.querySelector('#title')) return 'title';
          if (child.querySelector('#description')) return 'description';
          if (child.querySelector('#name')) return 'name';
          if (child.querySelector('#email')) return 'email';
          if (child.querySelector('#include-screenshot')) return 'screenshot';
          if (child.classList.contains('bd-actions')) return 'actions';
          return null;
        })
        .filter(Boolean)
    );

    expect(fieldOrder).toEqual([
      'category',
      'title',
      'description',
      'name',
      'email',
      'screenshot',
      'actions',
    ]);

    const formFields = [
      host.locator('css=.bd-category-selector'),
      host.locator('css=#title'),
      host.locator('css=#description'),
      host.locator('css=#name'),
      host.locator('css=#email'),
      host.locator('css=#include-screenshot'),
    ];
    const boxes = await Promise.all(formFields.map(locator => locator.boundingBox()));

    expect(boxes.every(Boolean)).toBe(true);
    for (let i = 1; i < boxes.length; i += 1) {
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    }

    const categoryBox = await host.locator('css=.bd-category-selector').boundingBox();
    expect(categoryBox?.height).toBeLessThan(60);
  });

  test('bug category is selected by default', async ({ page }) => {
    // Mock installation check
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/index.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });
    await trigger.click();
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    const continueBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await continueBtn.click();

    // Wait for form to appear
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Bug should be checked by default
    const bugOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="bug"]');
    await expect(bugOption).toBeChecked();
  });

  test('can select different categories', async ({ page }) => {
    // Mock installation check
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });

    await page.goto('/test/index.html');

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });
    await trigger.click();
    await page.locator('#bugdrop-host').locator('css=.bd-modal').waitFor();

    const continueBtn = page.locator('#bugdrop-host').locator('css=[data-action="continue"]');
    await continueBtn.click();

    // Wait for form to appear
    const titleInput = page.locator('#bugdrop-host').locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Select feature
    const featureOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="feature"]');
    await featureOption.click();
    await expect(featureOption).toBeChecked();

    // Bug should no longer be checked
    const bugOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="bug"]');
    await expect(bugOption).not.toBeChecked();

    // Select question
    const questionOption = page
      .locator('#bugdrop-host')
      .locator('css=input[name="category"][value="question"]');
    await questionOption.click();
    await expect(questionOption).toBeChecked();
    await expect(featureOption).not.toBeChecked();
  });
});

test.describe('Custom Icon', () => {
  test('custom icon renders img element with correct src', async ({ page }) => {
    await page.goto('/test/icon-custom.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const trigger = page.locator('#bugdrop-host').locator('css=.bd-trigger');
    await expect(trigger).toBeVisible({ timeout: 5000 });

    // Should have an img inside the trigger icon
    const img = page.locator('#bugdrop-host').locator('css=.bd-trigger-icon img');
    await expect(img).toBeVisible();

    // Img src should contain the data URI
    const src = await img.getAttribute('src');
    expect(src).toContain('data:image/png;base64,');
  });

  test('broken icon URL falls back to default emoji', async ({ page }) => {
    // Navigate to a page and inject widget with broken icon URL
    await page.goto('/test/icon-custom.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    // Modify the page to use a broken URL by evaluating script
    await page.evaluate(() => {
      const host = document.getElementById('bugdrop-host');
      if (host) host.remove();

      const script = document.createElement('script');
      script.src = '/widget.js';
      script.dataset.repo = 'mean-weasel/bugdrop-widget-test';
      script.dataset.theme = 'dark';
      script.dataset.icon = 'https://invalid.example.com/nonexistent.png';
      document.body.appendChild(script);
    });

    const triggerIcon = page.locator('#bugdrop-host').locator('css=.bd-trigger-icon');
    await expect(triggerIcon).toBeVisible({ timeout: 5000 });

    // The img should be hidden (display:none from onerror) and fallback emoji visible
    const fallbackText = await triggerIcon.textContent();
    expect(fallbackText).toContain('🐛');
  });

  test('default emoji shows when no data-icon is set', async ({ page }) => {
    await page.goto('/test/index.html');
    await page.locator('#bugdrop-host').locator('css=.bd-trigger').waitFor();

    const triggerIcon = page.locator('#bugdrop-host').locator('css=.bd-trigger-icon');
    await expect(triggerIcon).toBeVisible({ timeout: 5000 });

    // Should NOT have an img element
    const img = page.locator('#bugdrop-host').locator('css=.bd-trigger-icon img');
    await expect(img).not.toBeAttached();

    // Should have the default emoji
    const text = await triggerIcon.textContent();
    expect(text).toContain('🐛');
  });
});

test.describe('Screenshot Crash Prevention (#67)', () => {
  const STUB_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Mock toPng via the widget's __bugdropMockToPng test seam (addInitScript
  // runs before the bundled IIFE, so the mock is in place when captureScreenshot fires)
  function mockHtmlToImage(page: Page, toPngBody: string) {
    return page.addInitScript(`window.__bugdropMockToPng = ${toPngBody};`);
  }

  // Spy mock: records opts and returns a valid PNG
  function spyToPng() {
    return `function(el, opts) {
      window.__captureOpts = opts;
      return Promise.resolve('${STUB_PNG}');
    }`;
  }

  function mockGetDisplayMedia(page: Page, body: string) {
    return page.addInitScript(`
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getDisplayMedia: ${body}
        },
        configurable: true
      });
    `);
  }

  function reporterLikePng(
    variant: 'preview-size' | 'small-wide-area' | 'annotation-style' | 'undo'
  ) {
    return `function(el, opts) {
      window.__captureOpts = opts;
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      if ('${variant}' === 'preview-size') {
        canvas.width = 1040;
        canvas.height = 260;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111827';
        ctx.font = '600 16px Arial';
        ctx.fillText('Widget', 36, 34);
        ctx.fillStyle = '#4b5563';
        ctx.font = '13px Arial';
        ctx.fillText('Password Widget v2', 36, 68);
        ctx.fillText('Preview settings are represented here with small but readable text.', 36, 98);
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(36, 120, 420, 24);
        ctx.fillStyle = '#6b7280';
        ctx.fillText('Location Widget #3', 48, 137);
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(36, 160, 520, 34);
        ctx.fillStyle = '#374151';
        ctx.fillText('Object: example.company/feature/preview', 48, 181);
      } else if ('${variant}' === 'small-wide-area') {
        canvas.width = 252;
        canvas.height = 54;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#525252';
        ctx.font = '28px Arial';
        ctx.fillText('Settlement Stage', 14, 36);
      } else if ('${variant}' === 'undo') {
        canvas.width = 600;
        canvas.height = 300;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111827';
        ctx.font = '600 18px Arial';
        ctx.fillText('Undo regression canvas', 24, 38);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(36, 82, 210, 128);
        ctx.fillRect(354, 82, 210, 128);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px Arial';
        ctx.fillText('First annotation area', 58, 150);
        ctx.fillText('Latest annotation area', 374, 150);
      } else {
        canvas.width = 1024;
        canvas.height = 252;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#2f2f2f';
        ctx.font = '500 16px Arial';
        ctx.fillText('Shipmen Overview', 24, 28);
        var labels = ['Schedule Stage', 'Weight Stage', 'Settlement Stage', 'Amount Stage'];
        var values = ['30-04-2026\\nForecasted', '25.000t\\nForecasted', "1'817.24\\nEUR/t\\nFinal", "45'431.03\\nEUR\\nForecasted"];
        var xs = [24, 260, 520, 770];
        labels.forEach(function(label, index) {
          ctx.fillStyle = '#4a4a4a';
          ctx.font = '14px Arial';
          ctx.fillText(label, xs[index], 72);
          ctx.fillStyle = '#f5f5f5';
          ctx.fillRect(xs[index], 86, 128, 66);
          ctx.fillStyle = index === 2 ? '#35a36d' : '#ef4444';
          ctx.beginPath();
          ctx.arc(xs[index] + 14, 106, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#777777';
          ctx.font = '600 14px Arial';
          values[index].split('\\n').forEach(function(line, lineIndex) {
            ctx.fillText(line, xs[index] + 28, 104 + lineIndex * 18);
          });
          ctx.fillStyle = '#8a8a8a';
          ctx.font = '13px Arial';
          ctx.fillText('Auto-derived status text for comparison', xs[index], 176);
        });
      }
      return Promise.resolve(canvas.toDataURL('image/png'));
    }`;
  }

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });
  });

  // Helper: open widget, click through welcome, fill title — returns the host locator
  async function navigateToForm(page: Page, title = 'Screenshot test') {
    const host = page.locator('#bugdrop-host');

    const button = host.locator('css=.bd-trigger');
    await expect(button).toBeVisible({ timeout: 5000 });
    await button.click();

    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(title);

    return host;
  }

  // Helper: navigate widget to screenshot options and return the host locator
  async function navigateToScreenshotOptions(page: Page) {
    const host = await navigateToForm(page);

    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await screenshotCheckbox.check();

    const continueBtn = host.locator('css=#submit-btn');
    await continueBtn.click();

    await expect(host.locator('css=[data-action="element"]')).toBeVisible({ timeout: 5000 });
    return host;
  }

  // Helper: navigate to screenshot options and click "Full Page"
  async function navigateToFullPageCapture(page: Page) {
    const host = await navigateToScreenshotOptions(page);
    const captureBtn = host.locator('css=[data-action="capture"]');
    await expect(captureBtn).toBeVisible({ timeout: 5000 });
    await captureBtn.click();
  }

  async function captureElementForAnnotation(page: Page, path: string, selector: string) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(path);

    const host = await navigateToScreenshotOptions(page);
    const elementBtn = host.locator('css=[data-action="element"]');
    await expect(elementBtn).toBeVisible({ timeout: 5000 });
    await elementBtn.click();
    await expect(page.locator('#bugdrop-element-picker-tooltip')).toBeVisible({ timeout: 5000 });

    const target = page.locator(selector);
    await expect(target).toBeVisible({ timeout: 5000 });
    const targetBox = await target.boundingBox();
    expect(targetBox).toBeTruthy();
    const targetX = targetBox!.x + targetBox!.width / 2;
    const targetY = targetBox!.y + targetBox!.height / 2;
    await page.mouse.move(targetX, targetY);
    await page.mouse.click(targetX, targetY);

    const modal = host.locator('css=.bd-modal--annotator');
    const stage = host.locator('css=#annotation-canvas');
    const canvas = stage.locator('css=canvas');
    await expect(modal).toBeVisible({ timeout: 30000 });
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    return { host, modal, stage, canvas };
  }

  async function trackFeedbackSubmissions(page: Page) {
    let count = 0;
    await page.route('**/feedback', async route => {
      count++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, issueNumber: 1, issueUrl: '#', isPublic: false }),
      });
    });
    return () => count;
  }

  async function trackFeedbackPayloads(page: Page) {
    const payloads: Array<Record<string, unknown>> = [];
    await page.route('**/feedback', async route => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, issueNumber: 1, issueUrl: '#', isPublic: false }),
      });
    });
    return payloads;
  }

  async function expectReturnedToForm(host: ReturnType<Page['locator']>, title: string) {
    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(titleInput).toHaveValue(title);
  }

  async function countAnnotationPixels(canvas: ReturnType<Page['locator']>) {
    return canvas.evaluate(el => {
      const source = el as HTMLCanvasElement;
      const ctx = source.getContext('2d');
      if (!ctx) {
        throw new Error('Missing canvas context');
      }

      const { data } = ctx.getImageData(0, 0, source.width, source.height);
      let red = 0;
      let orange = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 200 && r > 220 && g < 80 && b < 80) {
          red++;
        }

        if (a > 200 && r > 245 && g > 140 && g < 180 && b > 80 && b < 120) {
          orange++;
        }
      }

      return { red, orange };
    });
  }

  async function countRedPixelsInRegion(
    canvas: ReturnType<Page['locator']>,
    region: { left: number; top: number; right: number; bottom: number }
  ) {
    return canvas.evaluate((el, targetRegion) => {
      const source = el as HTMLCanvasElement;
      const ctx = source.getContext('2d');
      if (!ctx) {
        throw new Error('Missing canvas context');
      }

      const xStart = Math.floor(source.width * targetRegion.left);
      const xEnd = Math.ceil(source.width * targetRegion.right);
      const yStart = Math.floor(source.height * targetRegion.top);
      const yEnd = Math.ceil(source.height * targetRegion.bottom);
      const { data, width } = ctx.getImageData(xStart, yStart, xEnd - xStart, yEnd - yStart);
      let red = 0;

      for (let y = 0; y < yEnd - yStart; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a > 200 && r > 220 && g < 80 && b < 80) {
            red++;
          }
        }
      }

      return red;
    }, region);
  }

  async function countRedPixelsInDataUrl(
    page: Page,
    dataUrl: string,
    region: { left: number; top: number; right: number; bottom: number }
  ) {
    return page.evaluate(
      async target => {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load screenshot payload'));
          img.src = target.dataUrl;
        });

        const source = document.createElement('canvas');
        source.width = img.width;
        source.height = img.height;
        const ctx = source.getContext('2d');
        if (!ctx) {
          throw new Error('Missing canvas context');
        }

        ctx.drawImage(img, 0, 0);

        const xStart = Math.floor(source.width * target.region.left);
        const xEnd = Math.ceil(source.width * target.region.right);
        const yStart = Math.floor(source.height * target.region.top);
        const yEnd = Math.ceil(source.height * target.region.bottom);
        const { data, width } = ctx.getImageData(xStart, yStart, xEnd - xStart, yEnd - yStart);
        let red = 0;

        for (let y = 0; y < yEnd - yStart; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a > 200 && r > 220 && g < 80 && b < 80) {
              red++;
            }
          }
        }

        return red;
      },
      { dataUrl, region }
    );
  }

  async function dragOnCanvas(
    page: Page,
    canvas: ReturnType<Page['locator']>,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) {
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.move(box!.x + from.x * box!.width, box!.y + from.y * box!.height);
    await page.mouse.down();
    await page.mouse.move(box!.x + to.x * box!.width, box!.y + to.y * box!.height, {
      steps: 12,
    });
    await page.mouse.up();
  }

  test('reduces pixelRatio on complex DOM pages (>3000 nodes)', async ({ page }) => {
    await mockHtmlToImage(page, spyToPng());
    await page.goto('/test/complex-dom.html');

    // Verify the page actually has >3000 nodes
    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeGreaterThan(3000);

    await navigateToFullPageCapture(page);

    // Wait for annotation step (capture succeeded)
    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 10000 });

    // Verify pixelRatio was reduced to 1 due to complex DOM
    const captureOpts = await page.evaluate(() => (window as any).__captureOpts);
    expect(captureOpts.pixelRatio).toBe(1);
  });

  test('uses normal pixelRatio on simple pages', async ({ page }) => {
    await mockHtmlToImage(page, spyToPng());
    await page.goto('/test/');

    // Verify simple page has <3000 nodes
    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeLessThan(3000);

    await navigateToFullPageCapture(page);

    // Wait for annotation step
    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 10000 });

    // pixelRatio should be >= 2 (default min scale)
    const captureOpts = await page.evaluate(() => (window as any).__captureOpts);
    expect(captureOpts.pixelRatio).toBeGreaterThanOrEqual(2);
  });

  test('no unhandled rejections after successful capture', async ({ page }) => {
    // Track unhandled promise rejections — verifies the timer is cleaned up
    const rejections: string[] = [];
    page.on('pageerror', err => rejections.push(err.message));

    await mockHtmlToImage(page, spyToPng());
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 10000 });

    // Wait long enough for a leaked timer to fire (timeout is 15s, capture is instant)
    await page.waitForTimeout(2000);

    const timeoutRejections = rejections.filter(m => m.includes('timed out'));
    expect(timeoutRejections).toHaveLength(0);
  });

  test('shows error modal when capture times out', async ({ page }) => {
    await mockHtmlToImage(page, 'function() { return new Promise(function() {}); }');
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    // The 15s timeout should fire and the error modal should appear
    const host = page.locator('#bugdrop-host');
    const errorText = host.locator('css=.bd-error-message__text');
    await expect(errorText).toBeVisible({ timeout: 20000 });
    await expect(errorText).toContainText('Failed to capture screenshot');

    // Verify retry and skip buttons are available
    const skipBtn = host.locator('css=[data-action="skip"]');
    const retryBtn = host.locator('css=[data-action="retry"]');
    await expect(skipBtn).toBeVisible();
    await expect(retryBtn).toBeVisible();
  });

  test('closing screenshot options returns to the form without submitting', async ({ page }) => {
    const getSubmissionCount = await trackFeedbackSubmissions(page);
    await page.goto('/test/');

    const host = await navigateToScreenshotOptions(page);

    await host.locator('css=.bd-close').click();

    await expectReturnedToForm(host, 'Screenshot test');
    expect(getSubmissionCount()).toBe(0);
  });

  test('closing capture error returns to the form without submitting', async ({ page }) => {
    const getSubmissionCount = await trackFeedbackSubmissions(page);
    await mockHtmlToImage(page, "function() { return Promise.reject(new Error('mock failure')); }");
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const errorText = host.locator('css=.bd-error-message__text');
    await expect(errorText).toBeVisible({ timeout: 5000 });

    await host.locator('css=.bd-close').click();

    await expectReturnedToForm(host, 'Screenshot test');
    expect(getSubmissionCount()).toBe(0);
  });

  test('closing annotation step returns to the form without submitting', async ({ page }) => {
    const getSubmissionCount = await trackFeedbackSubmissions(page);
    await mockHtmlToImage(page, spyToPng());
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const annotationCanvas = host.locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 10000 });

    await host.locator('css=.bd-close').click();

    await expectReturnedToForm(host, 'Screenshot test');
    expect(getSubmissionCount()).toBe(0);
  });

  test('skip button on error modal continues without screenshot', async ({ page }) => {
    await mockHtmlToImage(page, "function() { return Promise.reject(new Error('mock failure')); }");
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    // Wait for error modal
    const host = page.locator('#bugdrop-host');
    const errorText = host.locator('css=.bd-error-message__text');
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Click "Skip Screenshot" — should proceed to submission (no annotation step)
    const skipBtn = host.locator('css=[data-action="skip"]');
    await skipBtn.click();

    // Error modal should be gone and submission should proceed
    await expect(errorText).not.toBeVisible({ timeout: 3000 });
  });

  test('retry button on error modal re-attempts capture', async ({ page }) => {
    // First call fails, second call succeeds
    await mockHtmlToImage(
      page,
      `function(el, opts) {
        if (!window.__retryAttempted) {
          window.__retryAttempted = true;
          return Promise.reject(new Error('first attempt fails'));
        }
        return Promise.resolve('${STUB_PNG}');
      }`
    );

    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    // Wait for error modal from first failure
    const host = page.locator('#bugdrop-host');
    const errorText = host.locator('css=.bd-error-message__text');
    await expect(errorText).toBeVisible({ timeout: 5000 });

    // Click "Try Again"
    const retryBtn = host.locator('css=[data-action="retry"]');
    await retryBtn.click();

    // Second attempt succeeds — annotation canvas should appear
    const annotationCanvas = host.locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 10000 });
  });

  // --- Full-page disable threshold (10k+ nodes) ---

  test('hides Full Page and Select Area buttons on very complex pages without native viewport capture', async ({
    page,
  }) => {
    await mockHtmlToImage(page, spyToPng());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        configurable: true,
      });
    });
    await page.goto('/test/complex-dom.html?nodes=12000');

    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeGreaterThanOrEqual(10000);

    const host = await navigateToScreenshotOptions(page);

    // Select Element should still be visible
    await expect(host.locator('css=[data-action="element"]')).toBeVisible();

    // Full Page and Select Area should be hidden
    await expect(host.locator('css=[data-action="capture"]')).not.toBeAttached();
    await expect(host.locator('css=[data-action="area"]')).not.toBeAttached();

    // Complexity notice should be shown
    const notice = host.locator('css=p >> text=too complex');
    await expect(notice).toBeVisible();
  });

  test('offers native viewport capture on very complex secure-context pages', async ({ page }) => {
    const payloads = await trackFeedbackPayloads(page);
    await mockHtmlToImage(
      page,
      "function() { throw new Error('html-to-image should not run for viewport capture'); }"
    );
    await mockGetDisplayMedia(
      page,
      `function(opts) {
        window.__viewportCaptureCalls = (window.__viewportCaptureCalls || 0) + 1;
        window.__viewportCaptureUserActivation = navigator.userActivation.isActive;
        window.__viewportCaptureOpts = opts;
        var canvas = document.createElement('canvas');
        canvas.width = 960;
        canvas.height = 540;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#101827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(40, 40, 880, 120);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px sans-serif';
        ctx.fillText('Native viewport capture', 80, 115);
        var stream = canvas.captureStream();
        var track = stream.getVideoTracks()[0];
        var originalStop = track.stop.bind(track);
        track.getSettings = function() { return { displaySurface: 'browser' }; };
        track.stop = function() {
          window.__viewportTrackStops = (window.__viewportTrackStops || 0) + 1;
          originalStop();
        };
        return Promise.resolve(stream);
      }`
    );
    await page.goto('/test/complex-dom.html?nodes=12000');

    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeGreaterThanOrEqual(10000);

    const host = await navigateToScreenshotOptions(page);

    const viewportBtn = host.locator('css=[data-action="viewport"]');
    await expect(viewportBtn).toBeVisible();
    await expect(viewportBtn).toHaveText('Capture Viewport');
    await expect(host.locator('css=[data-action="capture"]')).not.toBeAttached();
    await expect(host.locator('css=[data-action="area"]')).not.toBeAttached();
    await expect(host.locator('css=p >> text=visible viewport')).toBeVisible();

    await viewportBtn.click();

    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect(host.locator('css=#annotation-canvas canvas')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __viewportCaptureCalls?: number }).__viewportCaptureCalls || 0
        )
      )
      .toBe(1);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __viewportTrackStops?: number }).__viewportTrackStops || 0
        )
      )
      .toBe(1);
    const viewportCapture = await page.evaluate(() => {
      const win = window as Window & {
        __viewportCaptureOpts?: DisplayMediaStreamOptions & { preferCurrentTab?: boolean };
        __viewportCaptureUserActivation?: boolean;
      };
      return {
        opts: win.__viewportCaptureOpts,
        userActivation: win.__viewportCaptureUserActivation,
      };
    });
    expect(viewportCapture.userActivation).toBe(true);
    expect(viewportCapture.opts).toEqual({
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
    });
    const captureOpts = await page.evaluate(
      () => (window as Window & { __captureOpts?: unknown }).__captureOpts
    );
    expect(captureOpts).toBeUndefined();

    await host.locator('css=[data-action="done"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });
    expect(payloads).toHaveLength(1);
    expect(payloads[0].screenshot).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
  });

  test('retries native viewport capture from the capture error modal', async ({ page }) => {
    await mockGetDisplayMedia(
      page,
      `function() {
        window.__viewportCaptureCalls = (window.__viewportCaptureCalls || 0) + 1;
        if (window.__viewportCaptureCalls === 1) {
          return Promise.reject(new Error('Permission denied'));
        }
        var canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        canvas.getContext('2d').fillRect(0, 0, 2, 2);
        var stream = canvas.captureStream();
        stream.getVideoTracks()[0].getSettings = function() { return { displaySurface: 'browser' }; };
        return Promise.resolve(stream);
      }`
    );
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="viewport"]').click();

    const errorText = host.locator('css=.bd-error-message__text');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __viewportCaptureCalls?: number }).__viewportCaptureCalls || 0
        )
      )
      .toBe(1);

    await host.locator('css=[data-action="retry"]').click();

    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __viewportCaptureCalls?: number }).__viewportCaptureCalls || 0
        )
      )
      .toBe(2);
  });

  test('rejects non-browser native capture surfaces before annotation', async ({ page }) => {
    await mockGetDisplayMedia(
      page,
      `function() {
        var canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        var stream = canvas.captureStream();
        var track = stream.getVideoTracks()[0];
        var originalStop = track.stop.bind(track);
        track.getSettings = function() { return { displaySurface: 'monitor' }; };
        track.stop = function() {
          window.__viewportTrackStops = (window.__viewportTrackStops || 0) + 1;
          originalStop();
        };
        return Promise.resolve(stream);
      }`
    );
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="viewport"]').click();

    await expect(host.locator('css=.bd-error-message__text')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=.bd-modal--annotator')).not.toBeAttached();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __viewportTrackStops?: number }).__viewportTrackStops || 0
        )
      )
      .toBe(1);
  });

  test('remembers complex-page screenshot skip for issue #116 repeated reports', async ({
    page,
  }) => {
    const payloads = await trackFeedbackPayloads(page);
    await page.goto('/test/complex-dom.html?nodes=12000');

    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeGreaterThanOrEqual(10000);

    const host = await navigateToScreenshotOptions(page);
    await expect(host.locator('css=p >> text=too complex')).toBeVisible();

    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });
    expect(payloads).toHaveLength(1);

    await host.locator('css=.bd-close').click();
    await host.locator('css=.bd-trigger').click();

    const secondTitle = host.locator('css=#title');
    await expect(secondTitle).toBeVisible({ timeout: 5000 });
    await secondTitle.fill('Issue 116 second report');

    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await expect(screenshotCheckbox).not.toBeChecked();

    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=[data-action="element"]')).not.toBeVisible();
    await expect(host.locator('css=p >> text=too complex')).not.toBeVisible();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });
    expect(payloads).toHaveLength(2);

    for (const payload of payloads) {
      const metadata = payload.metadata as { domNodeCount?: number; fullPageDisabled?: boolean };
      expect(payload.screenshot).toBeNull();
      expect(metadata.domNodeCount).toBeGreaterThanOrEqual(10000);
      expect(metadata.fullPageDisabled).toBe(true);
    }
  });

  test('persists complex-page screenshot skip after reload for issue #116', async ({ page }) => {
    const payloads = await trackFeedbackPayloads(page);
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });

    await page.reload();
    await host.locator('css=.bd-trigger').click();

    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Issue 116 after reload');

    await expect(host.locator('css=#include-screenshot')).not.toBeChecked();
    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=[data-action="element"]')).not.toBeVisible();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });
    expect(payloads).toHaveLength(2);
    expect(payloads[1].screenshot).toBeNull();
  });

  test('complex-page screenshot skip is scoped to redacted page and current complexity', async ({
    page,
  }) => {
    await trackFeedbackSubmissions(page);
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });

    await page.goto('/test/complex-dom.html?nodes=4000');
    await host.locator('css=.bd-trigger').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=#include-screenshot')).toBeChecked();
    await host.locator('css=.bd-close').click();

    await page.goto('/test/complex-dom.html?nodes=12001');
    await host.locator('css=.bd-trigger').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=#include-screenshot')).not.toBeChecked();
  });

  test('complex-page screenshot skip is scoped by repo', async ({ page }) => {
    await trackFeedbackSubmissions(page);
    await page.goto('/test/complex-dom.html?nodes=12000&repo=owner/repo-a');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });

    await page.goto('/test/complex-dom.html?nodes=12000&repo=owner/repo-b');
    await host.locator('css=.bd-trigger').click();
    await host.locator('css=[data-action="continue"]').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=#include-screenshot')).toBeChecked();
  });

  test('complex-page screenshot skip does not apply after same-url DOM becomes simple', async ({
    page,
  }) => {
    await trackFeedbackSubmissions(page);
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });
    await host.locator('css=.bd-close').click();

    await page.evaluate(() => {
      document.querySelector('#complex-root')?.replaceChildren();
    });

    await host.locator('css=.bd-trigger').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=#include-screenshot')).toBeChecked();
  });

  test('allows users to opt back into screenshots after complex-page skip', async ({ page }) => {
    await trackFeedbackSubmissions(page);
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });

    await host.locator('css=.bd-close').click();
    await host.locator('css=.bd-trigger').click();

    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Issue 116 opt back in');
    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await expect(screenshotCheckbox).not.toBeChecked();
    await screenshotCheckbox.check();
    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=p >> text=too complex')).toBeVisible();
    await expect(host.locator('css=[data-action="element"]')).toBeVisible();
  });

  test('remembers complex-page skip after element capture failure skip', async ({ page }) => {
    await trackFeedbackSubmissions(page);
    await mockHtmlToImage(page, "function() { return Promise.reject(new Error('mock failure')); }");
    await page.goto('/test/complex-dom.html?nodes=12000');

    const host = await navigateToScreenshotOptions(page);
    await host.locator('css=[data-action="element"]').click();
    await expect(page.locator('#bugdrop-element-picker-tooltip')).toBeVisible({ timeout: 5000 });

    const heading = page.locator('h1');
    const headingBox = await heading.boundingBox();
    expect(headingBox).toBeTruthy();
    await page.mouse.click(
      headingBox!.x + headingBox!.width / 2,
      headingBox!.y + headingBox!.height / 2
    );

    await expect(host.locator('css=.bd-error-message__text')).toBeVisible({ timeout: 5000 });
    await host.locator('css=[data-action="skip"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 5000 });

    await host.locator('css=.bd-close').click();
    await host.locator('css=.bd-trigger').click();
    await expect(host.locator('css=#title')).toBeVisible({ timeout: 5000 });
    await expect(host.locator('css=#include-screenshot')).not.toBeChecked();
  });

  test('shows all buttons on pages below 10k nodes', async ({ page }) => {
    await mockHtmlToImage(page, spyToPng());
    await page.goto('/test/complex-dom.html?nodes=4000');

    const nodeCount = await page.evaluate(() => document.body.querySelectorAll('*').length);
    expect(nodeCount).toBeLessThan(10000);

    const host = await navigateToScreenshotOptions(page);

    await expect(host.locator('css=[data-action="element"]')).toBeVisible();
    await expect(host.locator('css=[data-action="capture"]')).toBeVisible();
    await expect(host.locator('css=[data-action="area"]')).toBeVisible();

    // Complexity notice should NOT be shown
    await expect(host.locator('css=p >> text=too complex')).not.toBeAttached();
  });

  test('annotation modal gives issue #117 style previews enough readable width', async ({
    page,
  }) => {
    await mockHtmlToImage(page, reporterLikePng('preview-size'));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const modal = host.locator('css=.bd-modal--annotator');
    const stage = host.locator('css=#annotation-canvas');
    const canvas = stage.locator('css=canvas');

    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    const modalBox = await modal.boundingBox();
    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();

    expect(modalBox?.width).toBeGreaterThanOrEqual(1040);
    expect(stageBox?.width).toBeGreaterThanOrEqual(980);
    expect(canvasBox?.width).toBeGreaterThanOrEqual(980);

    const toolbarBox = await host.locator('css=.bd-tools').boundingBox();
    const actionsBox = await host.locator('css=.bd-actions').boundingBox();
    expect(toolbarBox && stageBox ? toolbarBox.y + toolbarBox.height <= stageBox.y : false).toBe(
      true
    );
    expect(stageBox && actionsBox ? stageBox.y + stageBox.height <= actionsBox.y : false).toBe(
      true
    );
  });

  test('annotation stage frames issue #119 style short wide captures clearly', async ({ page }) => {
    await mockHtmlToImage(page, reporterLikePng('small-wide-area'));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const stage = host.locator('css=#annotation-canvas');
    const canvas = stage.locator('css=canvas');

    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(stageBox?.width).toBeGreaterThanOrEqual(980);
    expect(stageBox?.height).toBeGreaterThanOrEqual(230);
    expect(canvasBox?.width).toBeLessThan(320);
    expect(canvasBox?.height).toBeLessThan(90);

    const stageStyles = await stage.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        borderStyle: styles.borderTopStyle,
        borderWidth: styles.borderTopWidth,
        overflow: styles.overflow,
        padding: styles.paddingTop,
      };
    });

    expect(stageStyles.borderStyle).not.toBe('none');
    expect(parseFloat(stageStyles.borderWidth)).toBeGreaterThan(0);
    expect(stageStyles.overflow).toBe('auto');
    expect(parseFloat(stageStyles.padding)).toBeGreaterThan(0);

    expect(stageBox && canvasBox ? canvasBox.x > stageBox.x : false).toBe(true);
    expect(stageBox && canvasBox ? canvasBox.y > stageBox.y : false).toBe(true);
  });

  test('real element capture keeps issue #117 style content readable in annotation preview', async ({
    page,
  }) => {
    const { modal, stage, canvas } = await captureElementForAnnotation(
      page,
      '/test/annotation-preview-size.html',
      '#preview-size-target'
    );

    const modalBox = await modal.boundingBox();
    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();
    const intrinsicSize = await canvas.evaluate(el => ({
      width: (el as HTMLCanvasElement).width,
      height: (el as HTMLCanvasElement).height,
    }));

    expect(intrinsicSize.width).toBeGreaterThanOrEqual(1000);
    expect(intrinsicSize.height).toBeGreaterThanOrEqual(250);
    expect(modalBox?.width).toBeGreaterThanOrEqual(1040);
    expect(stageBox?.width).toBeGreaterThanOrEqual(980);
    expect(canvasBox?.width).toBeGreaterThanOrEqual(980);
  });

  test('real element capture clearly frames issue #119 style small annotation targets', async ({
    page,
  }) => {
    const { stage, canvas } = await captureElementForAnnotation(
      page,
      '/test/annotation-small-wide-area.html',
      '#small-wide-target'
    );

    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();
    const intrinsicSize = await canvas.evaluate(el => ({
      width: (el as HTMLCanvasElement).width,
      height: (el as HTMLCanvasElement).height,
    }));

    expect(intrinsicSize.width).toBeLessThanOrEqual(600);
    expect(intrinsicSize.height).toBeLessThanOrEqual(140);
    expect(stageBox?.width).toBeGreaterThanOrEqual(980);
    expect(stageBox?.height).toBeGreaterThanOrEqual(230);
    expect(canvasBox?.width).toBeLessThan(600);
    expect(canvasBox?.height).toBeLessThan(140);

    const frame = await stage.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        borderWidth: parseFloat(styles.borderTopWidth),
        padding: parseFloat(styles.paddingTop),
        overflow: styles.overflow,
      };
    });

    expect(frame.borderWidth).toBeGreaterThan(0);
    expect(frame.padding).toBeGreaterThan(0);
    expect(frame.overflow).toBe('auto');
    expect(stageBox && canvasBox ? canvasBox.x > stageBox.x : false).toBe(true);
    expect(stageBox && canvasBox ? canvasBox.y > stageBox.y : false).toBe(true);
  });

  test('annotation tools use high-contrast red styling for issue #115', async ({ page }) => {
    await mockHtmlToImage(page, reporterLikePng('annotation-style'));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test/annotation-style.html');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const stage = host.locator('css=#annotation-canvas');
    const canvas = stage.locator('css=canvas');
    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    const before = await countAnnotationPixels(canvas);

    await host.locator('css=[data-tool="arrow"]').click();
    await dragOnCanvas(page, canvas, { x: 0.72, y: 0.17 }, { x: 0.28, y: 0.34 });

    await host.locator('css=[data-tool="rect"]').click();
    await dragOnCanvas(page, canvas, { x: 0.58, y: 0.36 }, { x: 0.82, y: 0.72 });

    const after = await countAnnotationPixels(canvas);

    expect(after.red - before.red).toBeGreaterThan(2500);
    expect(after.orange - before.orange).toBeLessThan(100);

    const stageBox = await stage.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(stageBox?.width).toBeGreaterThanOrEqual(980);
    expect(canvasBox?.width).toBeGreaterThan(600);

    await page.screenshot({
      path: test.info().outputPath('issue-115-annotation-style.png'),
      fullPage: false,
    });
  });

  for (const tool of ['draw', 'arrow', 'rect'] as const) {
    test(`undo button removes the latest ${tool} annotation for issue #128`, async ({ page }) => {
      await mockHtmlToImage(page, reporterLikePng('undo'));
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/test/');
      await navigateToFullPageCapture(page);

      const host = page.locator('#bugdrop-host');
      const stage = host.locator('css=#annotation-canvas');
      const canvas = stage.locator('css=canvas');
      await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
      await expect(stage).toBeVisible();
      await expect(canvas).toBeVisible();
      await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).width)).toBe(600);

      await host.locator(`css=[data-tool="${tool}"]`).click();
      await dragOnCanvas(page, canvas, { x: 0.18, y: 0.28 }, { x: 0.42, y: 0.68 });
      await dragOnCanvas(page, canvas, { x: 0.58, y: 0.28 }, { x: 0.82, y: 0.68 });

      const firstRegion = { left: 0.1, top: 0.18, right: 0.48, bottom: 0.78 };
      const latestRegion = { left: 0.52, top: 0.18, right: 0.9, bottom: 0.78 };
      const firstBeforeUndo = await countRedPixelsInRegion(canvas, firstRegion);
      const latestBeforeUndo = await countRedPixelsInRegion(canvas, latestRegion);

      expect(firstBeforeUndo).toBeGreaterThan(20);
      expect(latestBeforeUndo).toBeGreaterThan(20);

      await host.locator('css=[data-action="undo"]').click();

      const firstAfterOneUndo = await countRedPixelsInRegion(canvas, firstRegion);
      const latestAfterOneUndo = await countRedPixelsInRegion(canvas, latestRegion);

      expect(firstAfterOneUndo).toBeGreaterThan(20);
      expect(latestAfterOneUndo).toBeLessThan(5);

      await host.locator('css=[data-action="undo"]').click();

      const firstAfterTwoUndos = await countRedPixelsInRegion(canvas, firstRegion);
      const latestAfterTwoUndos = await countRedPixelsInRegion(canvas, latestRegion);

      expect(firstAfterTwoUndos).toBeLessThan(5);
      expect(latestAfterTwoUndos).toBeLessThan(5);

      await host.locator('css=[data-action="undo"]').click();

      expect(await countRedPixelsInRegion(canvas, firstRegion)).toBeLessThan(5);
      expect(await countRedPixelsInRegion(canvas, latestRegion)).toBeLessThan(5);
    });
  }

  test('undo preserves mixed annotation history in the submitted screenshot for issue #128', async ({
    page,
  }) => {
    const payloads = await trackFeedbackPayloads(page);
    await mockHtmlToImage(page, reporterLikePng('undo'));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const stage = host.locator('css=#annotation-canvas');
    const canvas = stage.locator('css=canvas');
    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    const drawRegion = { left: 0.08, top: 0.18, right: 0.32, bottom: 0.78 };
    const arrowRegion = { left: 0.36, top: 0.18, right: 0.6, bottom: 0.78 };
    const undoneRectRegion = { left: 0.62, top: 0.18, right: 0.9, bottom: 0.5 };
    const finalRectRegion = { left: 0.62, top: 0.52, right: 0.9, bottom: 0.9 };

    await host.locator('css=[data-tool="draw"]').click();
    await dragOnCanvas(page, canvas, { x: 0.14, y: 0.28 }, { x: 0.3, y: 0.68 });

    await host.locator('css=[data-tool="arrow"]').click();
    await dragOnCanvas(page, canvas, { x: 0.4, y: 0.28 }, { x: 0.58, y: 0.68 });

    await host.locator('css=[data-tool="rect"]').click();
    await dragOnCanvas(page, canvas, { x: 0.66, y: 0.22 }, { x: 0.86, y: 0.45 });

    expect(await countRedPixelsInRegion(canvas, drawRegion)).toBeGreaterThan(20);
    expect(await countRedPixelsInRegion(canvas, arrowRegion)).toBeGreaterThan(20);
    expect(await countRedPixelsInRegion(canvas, undoneRectRegion)).toBeGreaterThan(20);

    await host.locator('css=[data-action="undo"]').click();

    expect(await countRedPixelsInRegion(canvas, drawRegion)).toBeGreaterThan(20);
    expect(await countRedPixelsInRegion(canvas, arrowRegion)).toBeGreaterThan(20);
    expect(await countRedPixelsInRegion(canvas, undoneRectRegion)).toBeLessThan(5);

    await dragOnCanvas(page, canvas, { x: 0.66, y: 0.58 }, { x: 0.86, y: 0.84 });
    expect(await countRedPixelsInRegion(canvas, finalRectRegion)).toBeGreaterThan(20);

    await host.locator('css=[data-action="done"]').click();
    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });

    expect(payloads).toHaveLength(1);
    const submittedScreenshot = payloads[0].screenshot;
    expect(typeof submittedScreenshot).toBe('string');

    expect(
      await countRedPixelsInDataUrl(page, submittedScreenshot as string, drawRegion)
    ).toBeGreaterThan(20);
    expect(
      await countRedPixelsInDataUrl(page, submittedScreenshot as string, arrowRegion)
    ).toBeGreaterThan(20);
    expect(
      await countRedPixelsInDataUrl(page, submittedScreenshot as string, undoneRectRegion)
    ).toBeLessThan(5);
    expect(
      await countRedPixelsInDataUrl(page, submittedScreenshot as string, finalRectRegion)
    ).toBeGreaterThan(20);
  });

  test('undo cancels an unfinished annotation draft for issue #128', async ({ page }) => {
    await mockHtmlToImage(page, reporterLikePng('undo'));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/test/');
    await navigateToFullPageCapture(page);

    const host = page.locator('#bugdrop-host');
    const canvas = host.locator('css=#annotation-canvas canvas');
    await expect(host.locator('css=.bd-modal--annotator')).toBeVisible({ timeout: 10000 });
    await expect(canvas).toBeVisible();

    const committedRegion = { left: 0.08, top: 0.18, right: 0.32, bottom: 0.78 };
    const draftRegion = { left: 0.52, top: 0.18, right: 0.9, bottom: 0.78 };

    await dragOnCanvas(page, canvas, { x: 0.14, y: 0.28 }, { x: 0.3, y: 0.68 });
    expect(await countRedPixelsInRegion(canvas, committedRegion)).toBeGreaterThan(20);

    await host.locator('css=[data-tool="arrow"]').click();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.58, box!.y + box!.height * 0.28);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.68, {
      steps: 12,
    });
    expect(await countRedPixelsInRegion(canvas, draftRegion)).toBeGreaterThan(20);

    await host.locator('css=[data-action="undo"]').dispatchEvent('click');
    await page.mouse.up();

    expect(await countRedPixelsInRegion(canvas, committedRegion)).toBeGreaterThan(20);
    expect(await countRedPixelsInRegion(canvas, draftRegion)).toBeLessThan(5);
  });

  // --- Metadata: domNodeCount and fullPageDisabled in submission payload ---

  // Helper: submit feedback without screenshot, capturing the POST body
  async function submitAndCaptureMetadata(page: Page) {
    let capturedMetadata: Record<string, unknown> | null = null;

    await page.route('**/feedback', async route => {
      const body = route.request().postDataJSON();
      capturedMetadata = body.metadata;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, issueNumber: 1, issueUrl: '#', isPublic: false }),
      });
    });

    const host = await navigateToForm(page, 'Metadata test');

    // Uncheck screenshot and submit
    const screenshotCheckbox = host.locator('css=#include-screenshot');
    await screenshotCheckbox.uncheck();

    const submitBtn = host.locator('css=#submit-btn');
    await submitBtn.click();

    // Wait for success modal (confirms submission completed)
    const successModal = host.locator('css=.bd-success-icon');
    await expect(successModal).toBeVisible({ timeout: 10000 });

    return capturedMetadata!;
  }

  test('includes domNodeCount and fullPageDisabled=false in metadata on simple pages', async ({
    page,
  }) => {
    await page.goto('/test/');

    const metadata = await submitAndCaptureMetadata(page);

    expect(metadata).toBeTruthy();
    expect(typeof metadata.domNodeCount).toBe('number');
    expect(metadata.domNodeCount).toBeGreaterThan(0);
    expect(metadata.domNodeCount).toBeLessThan(10000);
    expect(metadata.fullPageDisabled).toBe(false);
  });

  test('includes domNodeCount and fullPageDisabled=true in metadata on complex pages', async ({
    page,
  }) => {
    await page.goto('/test/complex-dom.html?nodes=12000');

    const metadata = await submitAndCaptureMetadata(page);

    expect(metadata).toBeTruthy();
    expect(typeof metadata.domNodeCount).toBe('number');
    expect(metadata.domNodeCount).toBeGreaterThanOrEqual(10000);
    expect(metadata.fullPageDisabled).toBe(true);
  });

  // --- Real capture (no mock) — verifies bundled html-to-image works ---

  test('real bundled html-to-image captures a screenshot without mocks', async ({ page }) => {
    await page.goto('/test/');

    // No __bugdropMockToPng — real html-to-image runs here
    await navigateToFullPageCapture(page);

    const annotationCanvas = page.locator('#bugdrop-host').locator('css=#annotation-canvas');
    await expect(annotationCanvas).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Screenshot Mode Configuration', () => {
  const STUB_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  async function setupInstalledApp(page: Page) {
    await page.route('**/api/check/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installed: true }),
      });
    });
  }

  async function setupSuccessfulSubmit(page: Page) {
    let payload: Record<string, unknown> | null = null;
    await page.route('**/feedback', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, issueNumber: 1, issueUrl: '#', isPublic: false }),
      });
    });
    return () => payload;
  }

  async function mockSuccessfulCapture(page: Page) {
    await page.addInitScript(`window.__bugdropMockToPng = function() {
      window.__autoCaptureCount = (window.__autoCaptureCount || 0) + 1;
      return Promise.resolve('${STUB_PNG}');
    };`);
  }

  async function openForm(page: Page) {
    const host = page.locator('#bugdrop-host');
    await expect(host.locator('css=.bd-trigger')).toBeVisible({ timeout: 5000 });
    await host.locator('css=.bd-trigger').click();

    const getStartedBtn = host.locator('css=[data-action="continue"]');
    await expect(getStartedBtn).toBeVisible({ timeout: 5000 });
    await getStartedBtn.click();

    const titleInput = host.locator('css=#title');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Screenshot mode test');
    return host;
  }

  test('auto mode captures and submits a screenshot without the manual screenshot step', async ({
    page,
  }) => {
    await setupInstalledApp(page);
    await mockSuccessfulCapture(page);
    const getPayload = await setupSuccessfulSubmit(page);

    await page.goto('/test/?screenshot=auto');
    const host = await openForm(page);

    await expect(host.locator('css=#include-screenshot')).not.toBeAttached();
    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });
    await expect(host.locator('css=[data-action="capture"]')).not.toBeAttached();
    await expect(host.locator('css=#annotation-canvas')).not.toBeAttached();

    const payload = getPayload();
    expect(payload?.screenshot).toBe(STUB_PNG);
    expect(
      await page.evaluate(
        () => (window as Window & { __autoCaptureCount?: number }).__autoCaptureCount
      )
    ).toBe(1);
  });

  test('auto mode skips full-page capture on very complex pages', async ({ page }) => {
    await setupInstalledApp(page);
    await mockSuccessfulCapture(page);
    const getPayload = await setupSuccessfulSubmit(page);

    await page.goto('/test/complex-dom.html?nodes=12000&screenshot=auto');
    const host = await openForm(page);

    await expect(host.locator('css=#include-screenshot')).not.toBeAttached();
    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });
    expect(getPayload()?.screenshot).toBeNull();
    expect(
      await page.evaluate(
        () => (window as Window & { __autoCaptureCount?: number }).__autoCaptureCount
      )
    ).toBeUndefined();
  });

  test('required mode removes the opt-out path and requires a capture before submit', async ({
    page,
  }) => {
    await setupInstalledApp(page);
    await mockSuccessfulCapture(page);
    const getPayload = await setupSuccessfulSubmit(page);

    await page.goto('/test/?screenshot=required');
    const host = await openForm(page);

    await expect(host.locator('css=#include-screenshot')).not.toBeAttached();
    await host.locator('css=#submit-btn').click();

    await expect(host.locator('css=[data-action="skip"]')).not.toBeAttached();
    await host.locator('css=[data-action="capture"]').click();

    await expect(host.locator('css=#annotation-canvas')).toBeVisible({ timeout: 10000 });
    await host.locator('css=[data-action="done"]').click();

    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });
    expect(getPayload()?.screenshot).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
  });

  test('annotation actions use distinct labels and submit from one primary action', async ({
    page,
  }) => {
    await setupInstalledApp(page);
    await mockSuccessfulCapture(page);
    const getPayload = await setupSuccessfulSubmit(page);

    await page.goto('/test/');
    const host = await openForm(page);

    await host.locator('css=#include-screenshot').check();
    await host.locator('css=#submit-btn').click();
    await host.locator('css=[data-action="capture"]').click();

    const annotationModal = host.locator('css=.bd-modal--annotator');
    await expect(annotationModal).toBeVisible({ timeout: 10000 });
    const annotationActions = annotationModal.locator('css=.bd-actions [data-action]');
    await expect(annotationActions).toHaveCount(2);

    expect(
      await annotationActions.evaluateAll(buttons =>
        buttons.map(button => ({
          action: (button as HTMLElement).dataset.action,
          label: (button as HTMLElement).textContent?.trim(),
        }))
      )
    ).toEqual([
      { action: 'retake', label: 'Retake' },
      { action: 'done', label: 'Submit Feedback' },
    ]);

    await expect(annotationModal.locator('css=[data-action="skip"]')).toHaveCount(0);
    await expect(annotationModal.getByRole('button', { name: 'Skip Annotations' })).toHaveCount(0);

    await annotationModal.locator('css=[data-action="done"]').click();

    await expect(host.locator('css=.bd-success-icon')).toBeVisible({ timeout: 10000 });
    expect(getPayload()?.screenshot).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
  });
});
