import { expect, test, type Route } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

test('Help articles load on demand and a late response cannot replace the current article', async ({
  page
}) => {
  const requestedArticles: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('.html') && url.searchParams.has('raw'))
      requestedArticles.push(url.pathname);
  });
  let pendingArticle: Route | undefined;
  await page.route(
    (url) => url.pathname.endsWith('/MarsHelpIntro.html') && url.searchParams.has('raw'),
    (route) => {
      pendingArticle = route;
    }
  );
  await openDesktop(page);
  expect(requestedArticles).toEqual([]);
  const helpMenu = page.locator('.menubar summary').filter({ hasText: /^Help$/ });
  await helpMenu.click();
  await page.getByRole('button', { name: 'Introduction', exact: true }).click();
  const introduction = page.getByRole('dialog', { name: 'Introduction', exact: true });
  await expect(introduction.getByRole('status')).toHaveText('Loading article…');
  await expect.poll(() => !!pendingArticle).toBe(true);
  expect(requestedArticles).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(introduction).toBeHidden();
  await expect(helpMenu).toBeFocused();
  await helpMenu.click();
  await page.getByRole('button', { name: 'Debugging', exact: true }).click();
  const debugging = page.getByRole('dialog', { name: 'Interactive Debugging', exact: true });
  await expect(debugging).toContainText('2000');
  await pendingArticle!.continue();
  await expect(debugging).toBeVisible();
  await expect(introduction).toBeHidden();
  await page.keyboard.press('Escape');
  await helpMenu.click();
  await page.getByRole('button', { name: 'Introduction', exact: true }).click();
  await expect(introduction).toContainText('Original article: Release 4.5 · August 2014');
  await expect(introduction.getByRole('article')).toBeFocused();
  expect(requestedArticles).toHaveLength(2);
});

test('a failed Help article displays an error and remains dismissible', async ({ page }) => {
  await page.route(
    (url) => url.pathname.endsWith('/MarsHelpIntro.html') && url.searchParams.has('raw'),
    (route) => route.abort('failed')
  );
  await openDesktop(page);
  const helpMenu = page.locator('.menubar summary').filter({ hasText: /^Help$/ });
  await helpMenu.click();
  await page.getByRole('button', { name: 'Introduction', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Introduction', exact: true });
  await expect(dialog.getByRole('alert')).toHaveText(
    'Unable to load this article. Reload the page and try again.'
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(helpMenu).toBeFocused();
});

test('Help menu opens all ten attributed articles and restores keyboard focus', async ({
  page
}) => {
  await openDesktop(page);
  const helpMenu = page.locator('.menubar summary').filter({ hasText: /^Help$/ });
  await helpMenu.click();
  const menu = page.locator('details[open] .menu');
  await expect(menu.getByRole('button').nth(0)).toHaveAccessibleName('Help F1');
  await expect(menu.getByRole('button').nth(1)).toHaveText('About MARS');
  await expect(menu.locator('button:nth-child(2) + hr')).toHaveCount(1);
  await helpMenu.click();
  const articles = [
    ['Introduction', 'Introduction', 'Original article: Release 4.5 · August 2014'],
    ['Debugging', 'Interactive Debugging', '2000'],
    ['Settings', 'Configuration Settings', 'localStorage'],
    ['Syscalls', 'Syscalls', 'Tony Brock in July 2007'],
    ['Exception Handlers', 'Exception Handlers', '.ktext 0x80000180'],
    ['Macros', 'Macros', 'Mohammad Hossein Sekhavat'],
    ['Tools', 'Tools — Legacy Reference', 'mars.tools.MarsTool'],
    ['Limitations', 'Requirements and Limitations', 'Historical Java limitations'],
    ['Release History', 'Release History', '23 January 2008'],
    ['Acknowledgements', 'Acknowledgements', 'Updated 18 August 2014']
  ];
  for (const [label, title, retainedText] of articles) {
    await helpMenu.click();
    await page.locator('.menubar').getByRole('button', { name: label, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('article')).toBeFocused();
    await expect(dialog).toContainText(retainedText);
    await expect(dialog).toContainText('Copyright © 2003–2013 Pete Sanderson and Kenneth Vollmar');
    await expect(dialog).not.toContainText('This document is available for printing');
    expect(await dialog.locator('.dialog-body').evaluate((body) => body.scrollTop)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(helpMenu).toBeFocused();
  }
  expect(page.context().pages()).toHaveLength(1);
});

test('syscall reference distinguishes implemented services from legacy contracts', async ({
  page
}) => {
  await openDesktop(page);
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Help$/ })
    .click();
  await page.getByRole('button', { name: 'Syscalls', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('list', { name: 'Syscall notes' }).getByRole('listitem')
  ).toHaveCount(8);
  const table = dialog.getByRole('table').first();
  await expect(
    table
      .getByRole('row')
      .filter({ has: page.getByRole('cell', { name: 'print integer', exact: true }) })
  ).toContainText('Available');
  for (const service of ['open file', 'set seed', 'MIDI out', 'ConfirmDialog']) {
    await expect(
      table.getByRole('row').filter({ has: page.getByRole('cell', { name: service, exact: true }) })
    ).toContainText('Not yet available');
  }
  await expect(
    dialog.getByRole('heading', { name: 'Legacy example of File I/O (not yet available)' })
  ).toBeAttached();
  const region = dialog.getByRole('region', { name: 'Syscall service reference' });
  const rowColors = await table
    .locator('tbody tr')
    .evaluateAll((rows) => rows.slice(0, 2).map((row) => getComputedStyle(row).backgroundColor));
  expect(rowColors[0]).not.toBe(rowColors[1]);
  await region.scrollIntoViewIfNeeded();
  const height = await region.evaluate((element) => element.clientHeight);
  expect(height).toBeLessThanOrEqual(420);
  expect(await region.evaluate((element) => element.scrollHeight)).toBeGreaterThan(height);
  await region.focus();
  await region.press('Control+End');
  await expect(
    table.getByRole('cell', { name: 'MessageDialogString', exact: true })
  ).toBeInViewport();
  await expect(table.getByRole('columnheader', { name: 'Code in $v0' })).toBeInViewport();
  const widths = await table
    .getByRole('columnheader')
    .evaluateAll((headers) => headers.map((header) => header.getBoundingClientRect().width));
  expect(Math.abs(widths[3] - widths[2])).toBeLessThan(1);
  expect(widths[0] / widths.reduce((a, b) => a + b, 0)).toBeCloseTo(0.2, 2);
  expect(widths[1] / widths.reduce((a, b) => a + b, 0)).toBeCloseTo(0.12, 1);
  expect(widths[4] / widths.reduce((a, b) => a + b, 0)).toBeCloseTo(0.16, 1);
  await page.screenshot({ path: '__build/help-syscall-table.png' });
  // Keyboard scrolling stays inside the modal and leaves its heading/close control visible.
  await dialog.getByRole('article').focus();
  await page.keyboard.press('Control+End');
  await expect
    .poll(() => dialog.locator('.dialog-body').evaluate((body) => body.scrollTop))
    .toBeGreaterThan(0);
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('code controls copy exact text and open a new source without replacing an existing buffer', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const existing = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
  await existing.fill('# keep this source');
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Help$/ })
    .click();
  await page.getByRole('button', { name: 'Exception Handlers', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exception Handlers', exact: true });
  const source = await dialog.locator('pre').first().textContent();
  expect(source).toContain('.ktext 0x80000180');
  await dialog.getByRole('button', { name: 'Copy code example 1', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
  await dialog
    .getByRole('button', { name: 'Open code example 1 as new file', exact: true })
    .click();
  await expect(dialog).toBeHidden();
  const created = page.getByRole('textbox', { name: 'Source mips2.asm', exact: true });
  await expect(created).toHaveValue(source!);
  await expect(created).toBeFocused();
  await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
  await expect(existing).toHaveValue('# keep this source');
});

test('every code block has controls and clipboard rejection shows recoverable feedback', async ({
  page
}) => {
  await openDesktop(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async () => {
        throw new Error('Permission denied');
      },
      configurable: true
    });
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .locator('.menubar summary')
      .filter({ hasText: /^Help$/ })
      .click();
    await page.getByRole('button', { name: 'Macros', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Macros', exact: true });
    await expect(dialog.locator('pre').first()).toBeVisible();
    const examples = await dialog.locator('pre').count();
    expect(examples).toBeGreaterThan(1);
    await expect(dialog.getByRole('button', { name: /^Copy code example/ })).toHaveCount(examples);
    await expect(dialog.getByRole('button', { name: /^Open code example/ })).toHaveCount(examples);
    await dialog.getByRole('button', { name: 'Copy code example 1', exact: true }).click();
    await expect(dialog.getByRole('status').first()).toContainText('Copy failed');
    await page.keyboard.press('Escape');
  }
});

test('F1 overview and long articles remain usable in dark mode at a smaller viewport', async ({
  page
}) => {
  await openDesktop(page);
  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog', { name: 'MARS Help', exact: true })).toContainText(
    'Save commits'
  );
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Help$/ })
    .click();
  await page.getByRole('button', { name: 'Release History', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Release History', exact: true });
  await expect(dialog).toContainText(/historical/i);
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '__build/help-history-dark.png' });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toBeHidden();
});
