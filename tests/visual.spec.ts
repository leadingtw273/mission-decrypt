import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Use a frozen fixture so snapshots stay stable when public/missions/_example.json
// is regenerated (which produces fresh ciphertext + a new personal key each time).
const EXAMPLE_ASSET = JSON.parse(readFileSync('tests/fixtures/visual-mission.json', 'utf-8'));
const TEST_GAME_ID = 'leadingtw';
const TEST_PERSONAL_KEY = '3D5V-69S3-CHMT-1JYQ';
const FROZEN_NOW = new Date('2026-04-29T13:00:00+08:00');

const VIEWPORTS = [
  { label: 'mobile', width: 390, height: 1700 },
  { label: 'md', width: 800, height: 1700 },
  { label: 'lg', width: 1024, height: 1700 },
  { label: 'xl', width: 1440, height: 1500 },
] as const;

async function mockMissionAsset(page: import('@playwright/test').Page) {
  await page.route('**/missions/_example.json?v=1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EXAMPLE_ASSET),
    });
  });
}

test.describe('static layouts (reduced motion)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockMissionAsset(page);
    await page.clock.install({ time: FROZEN_NOW });
  });

  for (const vp of VIEWPORTS) {
    test(`locked ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/?mission_id=_example');
      await expect(page.getByText('ACCESS LOCKED')).toBeVisible();
      await expect(page).toHaveScreenshot(`locked-${vp.label}.png`, {
        fullPage: true,
      });
    });

    test(`decrypted ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/?mission_id=_example');
      await page.getByLabel('Game ID').fill(TEST_GAME_ID);
      await page.getByLabel('Private Key').fill(TEST_PERSONAL_KEY);
      await page.getByRole('button', { name: 'START DECRYPTION' }).click();
      // reducedMotion=reduce skips the rAF reveal, so the image is up
      // immediately and the EXTREME pause never fires; just wait for the
      // hero image to be visible.
      await expect(page.getByAltText('奧里森空域集合點')).toBeVisible({ timeout: 5000 });
      await expect(page).toHaveScreenshot(`decrypted-${vp.label}.png`, {
        fullPage: true,
      });
    });
  }
});

test.describe('motion states', () => {
  test.beforeEach(async ({ page }) => {
    await mockMissionAsset(page);
    await page.clock.install({ time: FROZEN_NOW });
  });

  test('extreme warning panel xl', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/?mission_id=_example');
    await page.getByLabel('Game ID').fill(TEST_GAME_ID);
    await page.getByLabel('Private Key').fill(TEST_PERSONAL_KEY);
    await page.getByRole('button', { name: 'START DECRYPTION' }).click();
    // Wait for the rAF loop to reach the REQUIRED GEAR pause point.
    await expect(page.getByText('EXTREME CLASSIFICATION')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveScreenshot('extreme-warning-xl.png', {
      fullPage: true,
    });
  });
});
