import { expect, test } from '@playwright/test';
import { openDesktop, waitForDesktop } from './openDesktop.js';

test('speed buttons step through distinct evenly spaced settings with maximum only at the endpoint', async ({
  page
}) => {
  await openDesktop(page);
  const toolbar = page.getByLabel('Toolbar', { exact: true });
  const toolbarHeight = (await toolbar.boundingBox())!.height;
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Run speed', exact: true });
  const plus = page.getByRole('button', { name: 'Increase run speed', exact: true });
  const minus = page.getByRole('button', { name: 'Decrease run speed', exact: true });
  await expect(slider).toHaveAttribute('max', '36');
  await expect(slider).toHaveValue('36');
  await expect(plus).toBeDisabled();
  const sliderBox = (await slider.boundingBox())!;
  const plusBox = (await plus.boundingBox())!;
  const minusBox = (await minus.boundingBox())!;
  const toolbarBox = (await toolbar.boundingBox())!;
  expect(toolbarBox.height).toBe(toolbarHeight);
  expect(plusBox.y).toBeGreaterThanOrEqual(toolbarBox.y);
  expect(minusBox.y + minusBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height);
  expect(plusBox.x).toBeGreaterThan(sliderBox.x + sliderBox.width);
  expect(minusBox.x).toBe(plusBox.x);
  expect(minusBox.y).toBeGreaterThan(plusBox.y);
  await minus.click();
  await expect(slider).toHaveValue('35');
  await expect(page.locator('.speed')).toHaveText('Run speed 30 inst/sec');
  await slider.fill('0');
  await expect(minus).toBeDisabled();
  await expect(page.locator('.speed')).toHaveText('Run speed 0.05 inst/sec');
  const finiteSpeeds = [
    '0.1',
    '0.2',
    '0.3',
    '0.4',
    '0.5',
    ...Array.from({ length: 30 }, (_, i) => String(i + 1))
  ];
  for (const [index, speed] of finiteSpeeds.entries()) {
    await plus.click();
    await expect(slider).toHaveValue(String(index + 1));
    await expect(page.locator('.speed')).toHaveText(`Run speed ${speed} inst/sec`);
  }
  await plus.click();
  await expect(slider).toHaveValue('36');
  await expect(page.locator('.speed')).toHaveText('Run speed at max (no interaction)');
  await expect(plus).toBeDisabled();
  const fill = () => slider.evaluate((input) => getComputedStyle(input).accentColor);
  await expect.poll(fill).toBe('rgb(196, 102, 31)');
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect.poll(fill).toBe('rgb(232, 166, 93)');
  await page.evaluate((value) => {
    if (value === null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', value);
  }, theme);
  await minus.click();
  await expect(slider).toHaveValue('35');
  await expect.poll(fill).toBe('auto');
  await page.reload();
  await waitForDesktop(page);
  await expect(slider).toHaveValue('35');
  await expect(page.locator('.speed')).toHaveText('Run speed 30 inst/sec');
  await page.evaluate(() => {
    const key = 'mars-ts:display-settings:v1';
    const saved = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...saved, speed: 38 }));
  });
  await page.reload();
  await waitForDesktop(page);
  await expect(slider).toHaveValue('36');
  await expect(page.locator('.speed')).toHaveText('Run speed at max (no interaction)');
  await minus.click();
  await expect(slider).toHaveValue('35');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(slider).toHaveCount(0);
  await expect(plus).toHaveCount(0);
  await expect(minus).toHaveCount(0);
  expect((await toolbar.boundingBox())!.height).toBe(toolbarHeight);
});
