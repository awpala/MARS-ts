import { test } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

test('desktop hydrates before parallel scenarios start', async ({ page }) => {
  await openDesktop(page);
});
