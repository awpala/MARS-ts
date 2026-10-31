import { expect, type Page } from '@playwright/test';

/**
 * Wait for the desktop's actual hydration/session readiness before testing working controls. Export uses its cross-browser
 * download-link path here; scenarios for Chromium's save picker install a stub with `stubSavePicker` after opening.
 */
export async function openDesktop(page: Page): Promise<void> {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  );
  await page.goto('/');
  await waitForDesktop(page);
}

/** Wait for restoration and machine initialization after initial navigation or reload. */
export async function waitForDesktop(page: Page): Promise<void> {
  await expect(page.getByTestId('desktop-controls')).toHaveAttribute('aria-busy', 'false', {
    timeout: 30000
  });
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
}

/** Seed browser-local source records and open selected names (all by default) through the actual Open dialog. */
export async function openStoredSources(
  page: Page,
  sources: { name: string; source: string }[],
  selectedNames: string[] = sources.map((source) => source.name)
): Promise<void> {
  await page.evaluate(
    (records) => localStorage.setItem('mars-ts:sources:v1', JSON.stringify(records)),
    sources
  );
  await page.getByRole('button', { name: 'Open ...', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Open', exact: true });
  for (const name of selectedNames) {
    await dialog.getByRole('checkbox', { name, exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Open', exact: true }).click();
}

/** Edit breakpoints one step below maximum run speed, where they are unlocked, then restore maximum speed; the speed controls appear only in Execute. */
export async function editBreakpoints(page: Page, edit: () => Promise<void>): Promise<void> {
  await page.getByRole('button', { name: 'Decrease run speed', exact: true }).click();
  await edit();
  await page.getByRole('button', { name: 'Increase run speed', exact: true }).click();
}

/** Replace Chromium's save picker with a stub that records each request, then saves to memory or reports cancellation. */
export async function stubSavePicker(page: Page, result: 'save' | 'cancel'): Promise<void> {
  await page.evaluate((result) => {
    const target = window as Window &
      typeof globalThis & {
        savedFiles: { name: string; text: string }[];
        savePickerRequests: string[];
      };
    target.savedFiles = [];
    target.savePickerRequests = [];
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async ({ suggestedName }: { suggestedName: string }) => {
        target.savePickerRequests.push(suggestedName);
        if (result === 'cancel')
          throw new DOMException('The user aborted a request.', 'AbortError');
        return {
          createWritable: async () => ({
            write: async (data: Blob) => {
              target.savedFiles.push({ name: suggestedName, text: await data.text() });
            },
            close: async () => undefined
          })
        };
      }
    });
  }, result);
}

/** Simulate a browser or OS dialog holding system focus: the page reports no focus until `restorePageFocus`. */
export async function losePageFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    window.dispatchEvent(new Event('blur'));
  });
}

/** End `losePageFocus`: the page reports focus again and receives the focus event a closing dialog delivers. */
export async function restorePageFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    delete (document as { hasFocus?: unknown }).hasFocus;
    window.dispatchEvent(new Event('focus'));
  });
}

/** Record, in order and without repeats, the accessible name of every transfer status the desktop shows from now on. */
export async function recordTransferStatuses(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { transferStatuses: string[] }).transferStatuses = seen;
    new MutationObserver(() => {
      for (const dialog of document.querySelectorAll('dialog[aria-busy="true"]')) {
        const status = dialog.getAttribute('aria-label') ?? '';
        if (seen.at(-1) !== status) seen.push(status);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-label']
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { transferStatuses: string[] }).transferStatuses);
}
