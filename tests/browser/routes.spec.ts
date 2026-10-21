import { expect, test } from '@playwright/test';
import { waitForDesktop } from './openDesktop.js';

for (const theme of ['light', 'dark'] as const) {
  test(`unknown routes show a centered ${theme} fallback and return to the IDE`, async ({
    page
  }) => {
    await page.addInitScript((theme) => localStorage.setItem('mars-ts:theme:v1', theme), theme);
    for (const path of ['/missing', '/missing/nested/page', '/unknown.txt']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      await expect(page.locator('main')).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(32, 40, 51)' : 'rgb(237, 237, 237)'
      );
      const pane = await page.locator('main section').boundingBox();
      const viewport = page.viewportSize()!;
      expect(pane).not.toBeNull();
      expect(Math.abs(pane!.x + pane!.width / 2 - viewport.width / 2)).toBeLessThan(2);
      expect(Math.abs(pane!.y + pane!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    }
    await page.getByRole('link', { name: 'Back to MARS' }).click();
    await expect(page).toHaveURL('/');
    await waitForDesktop(page);
  });
}

test('crawler documents remain plain text outside the error fallback', async ({ request }) => {
  for (const path of ['/llms.txt', '/robots.txt']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(await response.text()).not.toContain('Page not found');
  }
});
