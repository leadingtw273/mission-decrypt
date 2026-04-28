import { test, expect } from '@playwright/test';

test('encrypt + decrypt round-trip works in this browser', async ({ page }) => {
  await page.goto('/?cross-browser-harness=1');
  // The harness is registered on `window.__harness` by main.tsx in dev mode.
  await page.waitForFunction(() => (window as { __harness?: unknown }).__harness !== undefined, null, { timeout: 10_000 });

  const result = await page.evaluate(async () => {
    const harness = (window as unknown as { __harness: {
      run: () => Promise<{ ok: boolean; reason?: string }>;
    } }).__harness;
    return harness.run();
  });

  expect(result.ok, `cross-browser failure: ${result.reason ?? ''}`).toBe(true);
});
