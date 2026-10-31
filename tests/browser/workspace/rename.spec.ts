import { expect, test } from '@playwright/test';
import { openDesktop, openStoredSources, waitForDesktop } from '../harness/openDesktop.js';

test('inline rename updates the tab, editor, and saved name on Enter or blur; Escape cancels', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const draft = '.text\nmain: li $t0, 42\n';
  await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill(draft);
  const original = page.getByRole('button', { name: '* mips1.asm', exact: true });
  await original.dblclick();
  const input = page.getByRole('textbox', { name: 'Rename source file', exact: true });
  await expect(input).toBeFocused();
  await input.fill('cancelled.asm');
  await input.press('Escape');
  await expect(original).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mars-ts:sources:v1'))).toBeNull();

  await original.press('F2');
  await input.fill('converted.s');
  await input.press('Enter');
  const renamed = page.getByRole('button', { name: 'converted.s', exact: true });
  await expect(renamed).toBeVisible();
  await expect(renamed).toBeFocused();
  await expect(original).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close converted.s', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Source converted.s', exact: true })).toHaveValue(
    draft
  );
  await expect(page).toHaveTitle('converted.s - MARS');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([{ name: 'converted.s', source: draft }]);

  await renamed.dblclick();
  await input.fill('temperature.asm');
  await page.getByRole('textbox', { name: 'Source converted.s', exact: true }).click();
  await expect(page.getByRole('button', { name: 'temperature.asm', exact: true })).toBeVisible();
  await expect(renamed).toHaveCount(0);
  await expect(page).toHaveTitle('temperature.asm - MARS');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([{ name: 'temperature.asm', source: draft }]);
  await page.reload();
  await waitForDesktop(page);
  await expect(page.getByRole('button', { name: 'temperature.asm', exact: true })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Source temperature.asm', exact: true })
  ).toHaveValue(draft);
});

test('invalid inline names warn and retain the latest valid label, draft, and stored sources', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(page, [
    { name: 'taken.asm', source: '# another open source\n' },
    { name: 'original.asm', source: '# original\n' }
  ]);
  await page.getByRole('button', { name: 'original.asm', exact: true }).dblclick();
  const input = page.getByRole('textbox', { name: 'Rename source file', exact: true });
  await input.fill('latest.asm');
  await input.press('Enter');
  const draft = '# unsaved draft must survive invalid names\n';
  await page.getByRole('textbox', { name: 'Source latest.asm', exact: true }).fill(draft);
  const tab = page.getByRole('button', { name: '* latest.asm', exact: true });
  for (const name of [
    '',
    '.asm',
    'latest.txt',
    'latest.asm.txt',
    'latest.asm/',
    '../escape.asm',
    'taken.asm'
  ]) {
    await tab.dblclick();
    await expect(input).toHaveValue('latest.asm');
    await input.fill(name);
    if (name === 'taken.asm')
      await page.getByRole('textbox', { name: 'Source latest.asm', exact: true }).click();
    else await input.press('Enter');
    const warning = page.getByRole('dialog', { name: 'Invalid filename', exact: true });
    await expect(warning.getByRole('alert')).not.toBeEmpty();
    await expect(warning).toContainText('The filename remains “latest.asm”.');
    await expect(tab).toBeVisible();
    await warning.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(input).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Source latest.asm', exact: true })).toHaveValue(
      draft
    );
  }
  await expect(page).toHaveTitle('* latest.asm - MARS');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([
    { name: 'taken.asm', source: '# another open source\n' },
    { name: 'latest.asm', source: '# original\n' }
  ]);
});

test('inline rename preserves closed-file replacement confirmation and updates the tab only after confirmation', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    [
      { name: 'original.asm', source: '# original\n' },
      { name: 'target.asm', source: '# previous target\n' }
    ],
    ['original.asm']
  );
  const original = page.getByRole('button', { name: 'original.asm', exact: true });
  await original.dblclick();
  const input = page.getByRole('textbox', { name: 'Rename source file', exact: true });
  await input.fill('target.asm');
  await input.press('Enter');
  const save = page.getByRole('dialog', { name: 'Save As', exact: true });
  await expect(save.getByRole('button', { name: 'Replace', exact: true })).toBeVisible();
  await expect(original).toBeVisible();
  await save.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([
    { name: 'original.asm', source: '# original\n' },
    { name: 'target.asm', source: '# previous target\n' }
  ]);
  await original.dblclick();
  await input.fill('target.asm');
  await input.press('Enter');
  await save.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'target.asm', exact: true })).toBeVisible();
  await expect(original).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([{ name: 'target.asm', source: '# original\n' }]);
});

test('failed rename writes preserve the original tab and draft, and Save As Rename shares invalid-name warnings', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(page, [{ name: 'original.asm', source: '# saved\n' }]);
  const draft = '# edited\n';
  await page.getByRole('textbox', { name: 'Source original.asm', exact: true }).fill(draft);
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mars-ts:sources:v1')
        throw new DOMException('Storage is full', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  const original = page.getByRole('button', { name: '* original.asm', exact: true });
  await original.dblclick();
  const input = page.getByRole('textbox', { name: 'Rename source file', exact: true });
  await input.fill('renamed.asm');
  await input.press('Enter');
  const save = page.getByRole('dialog', { name: 'Save As', exact: true });
  await expect(save.getByRole('alert')).toContainText('Storage is full');
  await expect(original).toBeVisible();
  await save.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source original.asm', exact: true })).toHaveValue(
    draft
  );
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
  ).toEqual([{ name: 'original.asm', source: '# saved\n' }]);
  for (const name of ['malformed.asm.exe', '']) {
    await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
    await save.getByLabel('File name').fill(name);
    await save.getByRole('checkbox', { name: 'Rename existing file', exact: true }).check();
    await save.getByRole('button', { name: 'Save', exact: true }).click();
    const warning = page.getByRole('dialog', { name: 'Invalid filename', exact: true });
    await expect(warning).toContainText('The filename remains “original.asm”.');
    await warning.getByRole('button', { name: 'OK', exact: true }).click();
  }
  await expect(original).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Source original.asm', exact: true })).toHaveValue(
    draft
  );
});
