import { expect, test } from '@playwright/test';
import { openDesktop } from '../harness/openDesktop.js';

test('the page links a web app manifest whose icons are served', async ({ page, request }) => {
  await openDesktop(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();
  const manifestUrl = new URL(href!, page.url()).toString();
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ short_name: 'MARS', display: 'standalone' });
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512'])
  );
  for (const icon of manifest.icons as { src: string }[]) {
    const iconResponse = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }
});
