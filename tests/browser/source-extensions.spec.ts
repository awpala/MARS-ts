import { expect, test } from '@playwright/test';
import { readArchive } from './archive.js';
import { openDesktop, openStoredSources } from './openDesktop.js';

// The legacy app's Open dialog filters "Assembler Files (*.asm; *.s)" by case-insensitive extension (Config.properties).

test('Import offers and accepts both legacy assembly extensions regardless of case', async ({
  page
}) => {
  await openDesktop(page);
  const picker = page.getByLabel('Import assembly files', { exact: true });
  await expect(picker).toHaveAttribute('accept', '.asm,.s');
  await picker.setInputFiles([
    { name: 'legacy.s', mimeType: 'text/plain', buffer: Buffer.from('.text\nnop\n') },
    { name: 'UPPER.ASM', mimeType: 'text/plain', buffer: Buffer.from('.data\n.word 7\n') },
    { name: 'Mixed.S', mimeType: 'text/plain', buffer: Buffer.from('# mixed\n') }
  ]);
  await expect(page.getByRole('textbox', { name: 'Source Mixed.S', exact: true })).toHaveValue(
    '# mixed\n'
  );
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual(
    expect.arrayContaining([
      { name: 'legacy.s', source: '.text\nnop\n' },
      { name: 'UPPER.ASM', source: '.data\n.word 7\n' },
      { name: 'Mixed.S', source: '# mixed\n' }
    ])
  );
});

test('Import refuses other extensions without changing the library', async ({ page }) => {
  await openDesktop(page);
  await page.getByLabel('Import assembly files', { exact: true }).setInputFiles([
    { name: 'good.s', mimeType: 'text/plain', buffer: Buffer.from('nop\n') },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not assembly\n') }
  ]);
  const dialog = page.getByRole('dialog', { name: 'Replace imported sources?', exact: true });
  await expect(dialog.getByRole('alert')).toHaveText('Import accepts .asm or .s source files.');
  expect(await page.evaluate(() => localStorage.getItem('mars-ts:sources:v1'))).toBeNull();
});

test('Export keeps each recognized extension, and Export All keeps same-stem files distinct', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    [
      { name: 'util.s', source: '# gas style\n' },
      { name: 'util.asm', source: '# mars style\n' },
      { name: 'lib/util.s', source: '# nested\n' },
      { name: 'notes.txt', source: '# no assembly extension\n' }
    ],
    ['util.s']
  );
  const single = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await single).suggestedFilename()).toBe('util.s');

  const all = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export All', exact: true }).click();
  const archive = await all;
  expect(archive.suggestedFilename()).toBe('mars-asm-src-files.zip');
  expect(readArchive((await archive.path())!)).toEqual(
    expect.arrayContaining([
      { name: 'util.s', source: '# gas style\n' },
      { name: 'util.asm', source: '# mars style\n' },
      { name: 'util-2.s', source: '# nested\n' },
      { name: 'notes.asm', source: '# no assembly extension\n' }
    ])
  );
});
