import { test, expect } from '@playwright/test';
import { openDesktop, openStoredSources, stubSavePicker } from './openDesktop.js';
import { readFile } from 'node:fs/promises';

const source = '.data\n.word 0x12345678, -1\n.text\nli $t0, 42\nli $v0, 10\nsyscall\n';

async function assemble(
  page: import('@playwright/test').Page,
  program = source,
  filename = 'dump.asm'
) {
  await openDesktop(page);
  await expect(page.getByRole('button', { name: 'Dump Memory ...', exact: true })).toBeDisabled();
  await openStoredSources(page, [{ name: filename, source: program }]);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dump Memory ...', exact: true })).toBeEnabled();
}

test('dump selection saves each legacy format through the OS picker without changing source state', async ({
  page
}) => {
  await assemble(page);
  await stubSavePicker(page, 'save');
  const formats = ['AsciiText', 'Binary', 'BinaryText', 'HexText', 'HEX', 'SegmentWindow'];
  for (const descriptor of formats) {
    await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
    await expect(dialog.getByLabel('Memory Segment')).toContainText(
      '.text (0x00400000 - 0x00400008)'
    );
    await expect(dialog.getByLabel('Memory Segment')).toContainText(
      '.data (0x10010000 - 0x10010ffc)'
    );
    await dialog.getByLabel('Dump Format').selectOption(descriptor);
    await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  const files = await page.evaluate(
    () => (window as unknown as { savedFiles: { name: string; text: string }[] }).savedFiles
  );
  expect(files).toHaveLength(6);
  expect(files[2].text).toBe(
    '00100100000010000000000000101010\n00100100000000100000000000001010\n01111111111111111111111111001100\n'
  );
  expect(files[3].text).toBe('2408002a\n2402000a\n7fffffcc\n');
  expect(files[4].name).toBe('dump.text.hex');
  expect(files[4].text).toContain(':040000002408002AA6\n');
  expect(files[5].text).toContain(' Address    Code        Basic                     Source\n\n');
  expect(files[5].text).toContain('li $t0, 42');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source dump.asm', exact: true })).toHaveValue(
    source
  );
});

test('picker cancellation preserves choices, write failures remain visible, and data download contains raw bytes', async ({
  page
}) => {
  await assemble(page);
  await stubSavePicker(page, 'cancel');
  await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
  await dialog.getByLabel('Memory Segment').selectOption('.data');
  await dialog.getByLabel('Dump Format').selectOption('Binary');
  await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Dump To File...', exact: true })).toBeEnabled();
  await expect(dialog.getByLabel('Dump Format')).toHaveValue('Binary');
  await expect(dialog.getByLabel('Memory Segment')).toHaveValue('.data');
  await page.evaluate(() =>
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => ({
        createWritable: async () => ({
          write: async () => {
            throw new Error('Disk full');
          },
          close: async () => {},
          abort: async () => {}
        })
      })
    })
  );
  await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Disk full');
  await page.evaluate(() =>
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  );
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('dump.data.bin');
  const bytes = await readFile((await download.path())!);
  expect(bytes.length).toBe(4096);
  expect([...bytes.subarray(0, 8)]).toEqual([0x78, 0x56, 0x34, 0x12, 255, 255, 255, 255]);
  await expect(dialog).not.toBeVisible();
});

test('dump after execution reads the live data and dismissal restores the desktop', async ({
  page
}) => {
  await assemble(
    page,
    '.data\nvalue: .word 0\n.text\nli $t0, 99\nsw $t0, value\nli $v0, 10\nsyscall\n'
  );
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Dump Memory ...', exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await stubSavePicker(page, 'save');
  await trigger.click();
  await dialog.getByLabel('Memory Segment').selectOption('.data');
  await dialog.getByLabel('Dump Format').selectOption('HexText');
  await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const files = await page.evaluate(
    () => (window as unknown as { savedFiles: { name: string; text: string }[] }).savedFiles
  );
  expect(files[0].name).toBe('dump.data.hex');
  expect(files[0].text.startsWith('00000063\n')).toBe(true);
});

test('data-only and empty assemblies omit unpopulated dump choices', async ({ page }) => {
  await assemble(page, '.data\n.word 42\n');
  await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
  await expect(dialog.getByLabel('Memory Segment').getByRole('option')).toHaveCount(1);
  await expect(dialog.getByLabel('Memory Segment')).toHaveValue('.data');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Source dump.asm', exact: true }).fill('# empty');
  await expect(page.getByRole('button', { name: 'Dump Memory ...', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
  await expect(dialog).toContainText('No populated memory segments to dump.');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('dump dropdowns share light and dark field styling and retain native selection and focus', async ({
  page
}) => {
  await assemble(page);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark')
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
    const segment = dialog.getByLabel('Memory Segment');
    const format = dialog.getByLabel('Dump Format');
    const canvas = theme === 'dark' ? 'rgb(22, 30, 39)' : 'rgb(255, 255, 255)';
    const text = theme === 'dark' ? 'rgb(225, 233, 242)' : 'rgb(23, 32, 43)';
    for (const select of [segment, format]) {
      await expect(select).toHaveCSS('background-color', canvas);
      await expect(select).toHaveCSS('color', text);
      await expect(select.getByRole('option').first()).toHaveCSS('background-color', canvas);
      await expect(select.getByRole('option').first()).toHaveCSS('color', text);
    }
    await expect(segment).toBeFocused();
    await segment.press('ArrowDown');
    await expect(segment).toHaveValue('.data');
    await segment.press('Tab');
    await expect(format).toBeFocused();
    await expect(format).toHaveCSS('outline-style', 'solid');
    await format.selectOption('HEX');
    await expect(format).toHaveAttribute('title', 'Written as Intel Hex Memory File');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('dump filenames reference the assembled build rather than a different selected editor file', async ({
  page
}) => {
  await assemble(page, source, 'folder/program.S');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await openStoredSources(page, [{ name: 'unassembled.asm', source: '# another editor file' }]);
  await stubSavePicker(page, 'save');
  await page.getByRole('button', { name: 'Dump Memory ...', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dump Memory To File', exact: true });
  await dialog.getByLabel('Dump Format').selectOption('HexText');
  await dialog.getByRole('button', { name: 'Dump To File...', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const names = await page.evaluate(
    () => (window as unknown as { savePickerRequests: string[] }).savePickerRequests
  );
  expect(names).toEqual(['program.text.hex']);
});
