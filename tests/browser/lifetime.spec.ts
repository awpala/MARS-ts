import { expect, test, type Page } from '@playwright/test';
import { waitForDesktop } from './openDesktop.js';

/** Test-owned deferred browser operations; no production state or debugging hook is exposed. */
type LifetimeWindow = Window &
  typeof globalThis & {
    /** Releases the currently mounted production desktop. */
    releaseDesktop: () => Promise<void>;
    /** Pending file reads, resolved independently to exercise completion order. */
    fileReads: { resolve: (source: string) => void; reject: (error: Error) => void }[];
    /** Completes a deliberately suspended clipboard request. */
    completeClipboard: (text: string) => void;
    /** Refuses a deliberately suspended save picker, sending Export down its download-link path. */
    refuseSavePicker: () => void;
    /** Window blur listeners registered since recording began. */
    blurListeners: number;
  };

async function mountDesktop(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/lib/venus/mountDesktop.browser-test.ts';
    const { mountDesktop } = (await import(
      /* @vite-ignore */ path
    )) as typeof import('../../src/lib/venus/mountDesktop.browser-test.js');
    (window as LifetimeWindow).releaseDesktop = mountDesktop(document.body);
  });
  await waitForDesktop(page);
}

async function openIsolatedDesktop(page: Page) {
  await page.route('**/lifetime-test', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
  );
  await page.goto('/lifetime-test');
  await mountDesktop(page);
}

async function deferFileReads(page: Page) {
  await page.evaluate(() => {
    const target = window as LifetimeWindow;
    target.fileReads = [];
    Object.defineProperty(File.prototype, 'text', {
      configurable: true,
      value: () =>
        new Promise<string>((resolve, reject) => target.fileReads.push({ resolve, reject }))
    });
  });
}

for (const staleResult of ['success', 'error'] as const) {
  test(`a newer import selection supersedes an older ${staleResult}`, async ({ page }) => {
    await openIsolatedDesktop(page);
    await deferFileReads(page);
    const picker = page.getByLabel('Import assembly files', { exact: true });
    const file = { name: 'same.asm', mimeType: 'text/plain', buffer: Buffer.from('ignored') };
    await picker.setInputFiles(file);
    await picker.setInputFiles(file);
    await page.evaluate(() => (window as LifetimeWindow).fileReads[1].resolve('# newer'));
    await page
      .getByRole('dialog', { name: 'Import sources', exact: true })
      .getByRole('button', { name: 'Import', exact: true })
      .click();
    await expect(page.getByRole('textbox', { name: 'Source same.asm', exact: true })).toHaveValue(
      '# newer'
    );
    await page.evaluate((result) => {
      const read = (window as LifetimeWindow).fileReads[0];
      if (result === 'success') read.resolve('# older');
      else read.reject(new Error('stale read failed'));
    }, staleResult);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1') ?? '[]'))
    ).toEqual([{ name: 'same.asm', source: '# newer' }]);
  });
}

for (const command of ['Paste', 'Cut'] as const) {
  test(`delayed ${command} cannot edit source after execution starts`, async ({ page }) => {
    await openIsolatedDesktop(page);
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
    const program = '.text\nloop: b loop\n';
    await source.fill(program);
    await source.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(0, 5);
      element.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await page.evaluate((command) => {
      const target = window as LifetimeWindow;
      Object.defineProperty(navigator.clipboard, command === 'Paste' ? 'readText' : 'writeText', {
        configurable: true,
        value: () =>
          new Promise<string>((resolve) => {
            target.completeClipboard = resolve;
          })
      });
    }, command);
    await page
      .locator('.menubar summary')
      .filter({ hasText: /^Edit$/ })
      .click();
    await page.locator('details[open]').getByRole('button', { name: command, exact: true }).click();
    await page.getByRole('button', { name: 'Assemble', exact: true }).click();
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    await expect(stop).toBeEnabled();
    await page.evaluate(() => (window as LifetimeWindow).completeClipboard('# stale'));
    await stop.click();
    await expect(stop).toBeDisabled();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(source).toHaveValue(program);
    await expect(page.getByRole('textbox', { name: 'Mars Messages', exact: true })).not.toHaveValue(
      /Clipboard access was denied/
    );
  });
}

test('Help initializes its own new source before a subsequent command selects another buffer', async ({
  page
}) => {
  await openIsolatedDesktop(page);
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Help$/ })
    .click();
  await page.getByRole('button', { name: 'Exception Handlers', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exception Handlers', exact: true });
  const example = await dialog.locator('pre').first().textContent();
  await page.evaluate(() => {
    document
      .querySelector<HTMLButtonElement>('[aria-label="Open code example 1 as new file"]')!
      .click();
    document.querySelector<HTMLButtonElement>('[aria-label="New"]')!.click();
  });
  await expect(page.getByRole('textbox', { name: 'Source mips2.asm', exact: true })).toHaveValue(
    ''
  );
  await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source mips1.asm', exact: true })).toHaveValue(
    example!
  );
});

test('Help code controls keep their focus and feedback when execution stops', async ({ page }) => {
  await openIsolatedDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('.text\nloop: b loop\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => undefined
    })
  );
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Help$/ })
    .click();
  await page.getByRole('button', { name: 'Exception Handlers', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exception Handlers', exact: true });
  const copy = dialog.getByRole('button', { name: 'Copy code example 1', exact: true });
  const open = dialog.getByRole('button', {
    name: 'Open code example 1 as new file',
    exact: true
  });
  await expect(open).toBeDisabled();
  await copy.click();
  await expect(dialog.getByRole('status')).toHaveText('Copied');
  await copy.focus();
  await copy.evaluate((button) => button.setAttribute('data-original-control', ''));
  // Help keeps the toolbar inert, so end the run the way a program reaching its end would: without leaving the dialog.
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>('button[aria-label="Stop"]')!.click()
  );
  await expect(open).toBeEnabled();
  await expect(copy).toHaveAttribute('data-original-control', '');
  await expect(copy).toBeFocused();
  await expect(dialog.getByRole('status')).toHaveText('Copied');
});

test('an export settling after unmount installs no late save-prompt guard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openIsolatedDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill('# exported');
  await page.evaluate(() => {
    const target = window as LifetimeWindow;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: () =>
        new Promise((_, reject) => {
          target.refuseSavePicker = () =>
            reject(new DOMException('User activation is required.', 'NotAllowedError'));
        })
    });
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Waiting for save location…', exact: true })
  ).toBeVisible();
  await page.evaluate(() => (window as LifetimeWindow).releaseDesktop());
  await page.evaluate(() => {
    const target = window as LifetimeWindow;
    const add = window.addEventListener.bind(window);
    target.blurListeners = 0;
    window.addEventListener = ((...args: Parameters<typeof add>) => {
      if (args[0] === 'blur') target.blurListeners++;
      add(...args);
    }) as typeof window.addEventListener;
  });
  const download = page.waitForEvent('download');
  await page.evaluate(() => (window as LifetimeWindow).refuseSavePicker());
  await download;
  // The download-link fallback settles in the refusal's microtasks, before this later task runs.
  expect(await page.evaluate(() => (window as LifetimeWindow).blurListeners)).toBe(0);
  expect(errors).toEqual([]);
});

test('unmount releases pending work and remounts do not duplicate keyboard commands', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openIsolatedDesktop(page);
  await deferFileReads(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
  await source.fill('# retained');
  await page.evaluate(() => {
    const target = window as LifetimeWindow;
    Object.defineProperty(navigator.clipboard, 'readText', {
      configurable: true,
      value: () =>
        new Promise<string>((resolve) => {
          target.completeClipboard = resolve;
        })
    });
  });
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^Edit$/ })
    .click();
  await page.locator('details[open]').getByRole('button', { name: 'Paste', exact: true }).click();
  // The pending read blocks the desktop behind its status, so it starts after the other pending work.
  await page.getByLabel('Import assembly files', { exact: true }).setInputFiles({
    name: 'late.asm',
    mimeType: 'text/plain',
    buffer: Buffer.from('ignored')
  });
  await expect(page.getByRole('dialog', { name: 'Attempting import…', exact: true })).toBeVisible();
  await page.evaluate(() => (window as LifetimeWindow).releaseDesktop());
  await mountDesktop(page);
  await page.evaluate(() => {
    const target = window as LifetimeWindow;
    target.fileReads[0].resolve('# late import');
    target.completeClipboard('# late clipboard');
  });
  await expect(source).toHaveValue('# retained');
  expect(await page.evaluate(() => localStorage.getItem('mars-ts:sources:v1'))).toBeNull();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(() => (window as LifetimeWindow).releaseDesktop());
    await mountDesktop(page);
  }
  await page.keyboard.press('Alt+n');
  await expect(page.getByRole('button', { name: /^Close mips/ })).toHaveCount(2);
  expect(errors).toEqual([]);
});
