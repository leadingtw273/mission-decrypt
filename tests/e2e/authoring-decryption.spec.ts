import { expect, test } from '@playwright/test';

const HERO_IMAGE_PATH = new URL('./fixtures/hero.jpg', import.meta.url).pathname;

const missionFields = {
  missionCommander: 'Commander Lyra Voss',
  communicationChannel: 'VHF-7 encrypted relay',
  missionTime: '2956-11-03 23:40 UTC',
  rallyTime: '2956-11-03 23:10 UTC',
  rallyLocation: 'Orison Platform 4, Crusader',
  requiredGear: 'Thermal cloak, medpens, railgun',
  accessPermission: 'Level 4 green badge',
  rewardDistribution: '40/30/20/10 split after fuel',
  missionBrief: 'Extract the courier from Admin Platform and hold for silent transfer.',
} as const;

const heroAltText = 'Orison admin platform extraction route';

test('authoring download can be routed back into decryption flow', async ({ page }) => {
  await page.addInitScript(() => {
    const downloadStore = window as unknown as { __jsonDownloads?: Array<Promise<string>> };
    downloadStore.__jsonDownloads = [];

    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = ((object: Blob | MediaSource) => {
      if (object instanceof Blob && object.type === 'application/json') {
        downloadStore.__jsonDownloads?.push(object.text());
      }

      return originalCreateObjectURL(object);
    }) as typeof URL.createObjectURL;
  });

  await page.goto('/');

  await page.evaluate(() => {
    window.fleetOps.launchAuthoring();
  });

  await expect(page.getByRole('dialog', { name: 'Commander authoring modal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Commander Identity' })).toBeVisible();

  await page.getByRole('button', { name: 'Generate Commander Identity' }).click();
  await expect(page.getByRole('textbox', { name: 'Mission Commander' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Mission Commander' }).fill(missionFields.missionCommander);
  await page.getByRole('textbox', { name: 'Communication Channel' }).fill(missionFields.communicationChannel);
  await page.getByRole('textbox', { name: 'Mission Time' }).fill(missionFields.missionTime);
  await page.getByRole('textbox', { name: 'Rally Time' }).fill(missionFields.rallyTime);
  await page.getByRole('textbox', { name: 'Rally Location' }).fill(missionFields.rallyLocation);
  await page.getByRole('textbox', { name: 'Required Gear' }).fill(missionFields.requiredGear);
  await page.getByRole('textbox', { name: 'Access Permission' }).fill(missionFields.accessPermission);
  await page.getByRole('textbox', { name: 'Reward Distribution' }).fill(missionFields.rewardDistribution);
  await page.getByRole('textbox', { name: 'Mission Brief' }).fill(missionFields.missionBrief);
  await page.getByRole('textbox', { name: 'Hero Image Alt Text' }).fill(heroAltText);

  await page.getByRole('button', { name: 'Select Hero Image' }).click();
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles(HERO_IMAGE_PATH);
  await expect(page.getByText(/image\/jpeg .* bytes loaded/i)).toBeVisible();

  await page.getByRole('textbox', { name: 'Member 1 Game ID' }).fill('pilot7');
  await page.getByRole('button', { name: 'Add Member' }).click();
  await page.getByRole('textbox', { name: 'Member 2 Game ID' }).fill('ace42');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Mission' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^mission_.+\.json$/);
  await expect(page.getByText('Mission generated successfully')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);

  const firstRow = page.locator('tbody tr').first();
  const firstGameId = (await firstRow.getByRole('cell').nth(0).textContent())?.trim();
  const firstPersonalKey = (await firstRow.getByRole('cell').nth(1).textContent())?.trim();
  const firstMemberUrl = await firstRow.getByRole('link').getAttribute('href');

  expect(firstGameId).toBe('pilot7');
  expect(firstPersonalKey).toBeTruthy();
  expect(firstMemberUrl).toBeTruthy();

  const missionJsonText = await page.evaluate(async () => {
    const downloadStore = window as unknown as { __jsonDownloads?: Array<Promise<string>> };
    const latestDownload = downloadStore.__jsonDownloads?.at(-1);
    return latestDownload ? latestDownload : null;
  });

  expect(missionJsonText).toBeTruthy();
  const missionAsset = JSON.parse(missionJsonText ?? 'null') as { missionId: string };
  const missionUrl = new URL(firstMemberUrl ?? '');
  const missionId = missionUrl.searchParams.get('mission_id');

  expect(missionId).toBe(missionAsset.missionId);

  await page.route(`**/missions/${missionId}.json?v=1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: missionJsonText ?? '',
    });
  });

  await page.goto(firstMemberUrl ?? '/');

  await expect(page.getByText('ACCESS LOCKED')).toBeVisible();
  await page.getByLabel('Game ID').fill(firstGameId ?? '');
  await page.getByLabel('Private Key').fill(firstPersonalKey ?? '');
  await page.getByRole('button', { name: 'START DECRYPTION' }).click();

  await expect(page.getByAltText(heroAltText)).toBeVisible();
  await expect(page.getByText(missionFields.missionCommander, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.communicationChannel, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.missionTime, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.rallyTime, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.rallyLocation, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.requiredGear, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.accessPermission, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.rewardDistribution, { exact: true })).toBeVisible();
  await expect(page.getByText(missionFields.missionBrief, { exact: true })).toBeVisible();
});
