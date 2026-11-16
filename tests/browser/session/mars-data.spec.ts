import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { openDesktop, openStoredSources, waitForDesktop } from '../harness/openDesktop.js';

const PROGRAM = '.data\nvalue: .word 11\n.text\nli $t0, 7\nli $t1, 9\nli $v0, 10\nsyscall\n';
const schema = JSON.parse(
  readFileSync(new URL('../../../schemas/mars-ts-data.v1.schema.json', import.meta.url), 'utf8')
) as { $id: string };

/** The exported envelope as these scenarios inspect it. */
type Exported = {
  $schema: string;
  format: string;
  version: number;
  exportedAt: string;
  storage: Record<string, unknown>;
};

const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const picker = (page: Page) => page.getByLabel('Import MARS data file', { exact: true });
const importDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Import MARS data', exact: true });

/** The application's stored records as the payload mirrors them: parsed JSON, with theme and engine settings as text. */
async function storedData(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const records: Record<string, unknown> = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (!key.startsWith('mars-ts:')) continue;
      const raw = localStorage.getItem(key)!;
      records[key] =
        key === 'mars-ts:theme:v1' || key.startsWith('mars-ts:engine-settings:v1:')
          ? raw
          : JSON.parse(raw);
    }
    return records;
  });
}

/** Build a desktop with saved and unsaved sources, changed settings, and a stepped program, then export it. */
async function exportedData(page: Page): Promise<{ text: string; data: Exported }> {
  await openDesktop(page);
  await page.getByTestId('menu-settings-trigger').click();
  await page
    .getByTestId('menu-settings-content')
    .getByRole('checkbox', { name: 'Delayed branching', exact: true })
    .check();
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
  // The draft comes first: any later source edit would invalidate the loaded program.
  await action(page, 'New').click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('# unsaved draft\n');
  await openStoredSources(page, [{ name: 'program.asm', source: PROGRAM }]);
  await action(page, 'Assemble').click();
  await action(page, 'Step').click();
  await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
  await action(page, 'Show line numbers').click();
  const download = page.waitForEvent('download');
  await action(page, 'Export MARS').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('mars-ts-data.json');
  const text = await readFile((await file.path())!, 'utf8');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return { text, data: JSON.parse(text) as Exported };
}

test('Export MARS downloads a mirror of the stored application data in the schema envelope', async ({
  page
}) => {
  const { data } = await exportedData(page);
  expect(data.$schema).toBe(schema.$id);
  expect(data.format).toBe('mars-ts-data');
  expect(data.version).toBe(1);
  expect(Date.parse(data.exportedAt)).not.toBeNaN();
  expect(Object.keys(data).sort()).toEqual([
    '$schema',
    'exportedAt',
    'format',
    'storage',
    'version'
  ]);
  const { storage } = data;
  expect(storage).toEqual(await storedData(page));
  expect(Object.keys(storage).sort()).toEqual([
    'mars-ts:desktop-session:v1',
    'mars-ts:display-settings:v1',
    'mars-ts:engine-settings:v1:DelayedBranching',
    'mars-ts:sources:v1',
    'mars-ts:theme:v1',
    'mars-ts:workspace:v1'
  ]);
  expect(storage['mars-ts:sources:v1']).toEqual([{ name: 'program.asm', source: PROGRAM }]);
  expect(storage['mars-ts:workspace:v1']).toEqual([
    {
      name: 'mips1.asm',
      source: '# unsaved draft\n',
      savedSource: '',
      isNew: true,
      selected: false
    },
    { name: 'program.asm', source: PROGRAM, savedSource: PROGRAM, isNew: false, selected: true }
  ]);
  expect(storage['mars-ts:theme:v1']).toBe('dark');
  expect(storage['mars-ts:engine-settings:v1:DelayedBranching']).toBe('true');
  expect(storage['mars-ts:display-settings:v1']).toMatchObject({ showLines: false });
  // The session is flushed before capture, so the export holds the stepped program rather than a stale record.
  const session = storage['mars-ts:desktop-session:v1'] as {
    view: string;
    execution: { machine: { filename: string; status: string; registers: number[] } };
  };
  expect(session.view).toBe('Execute');
  expect(session.execution.machine).toMatchObject({ filename: 'program.asm', status: 'paused' });
  expect(session.execution.machine.registers[8]).toBe(7);
  // Exporting leaves the loaded program in place; the unsaved draft above is still unsaved.
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
});

test('Import MARS summarizes a conforming file, replaces all stored data after confirmation, and restarts into it', async ({
  page,
  browser,
  baseURL
}) => {
  const { text, data } = await exportedData(page);
  // A second browser profile with its own, different data receives the export.
  const context = await browser.newContext({ baseURL, serviceWorkers: 'block' });
  const other = await context.newPage();
  try {
    await openDesktop(other);
    await openStoredSources(other, [{ name: 'other.asm', source: '# other\n' }]);
    await other
      .getByRole('textbox', { name: 'Source other.asm', exact: true })
      .fill('# other, edited\n');
    await expect(other).toHaveTitle('* other.asm - MARS');
    const chosen = other.waitForEvent('filechooser');
    await action(other, 'Import MARS ...').click();
    const chooser = await chosen;
    expect(chooser.isMultiple()).toBe(false);
    await expect(picker(other)).toHaveAttribute('accept', '.json,application/json');
    await chooser.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text)
    });
    const dialog = importDialog(other);
    await expect(dialog).toContainText('Replace all MARS data in this browser with backup.json?');
    await expect(dialog.getByTestId('mars-data-filename')).toHaveText('backup.json');
    const summary = dialog.getByRole('list', { name: 'Data to import', exact: true });
    await expect(summary.getByRole('listitem')).toHaveText([
      'Saved sources1',
      'Open files2 (1 unsaved)',
      'Settings3 records',
      'Sessionprogram program.asm',
      /^Exported/
    ]);
    await expect(dialog.getByRole('alert')).toContainText(
      '1 open file has unsaved changes that will be lost.'
    );
    // Cancel changes nothing: the edited buffer and its library remain.
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(other).toHaveTitle('* other.asm - MARS');
    expect((await storedData(other))['mars-ts:sources:v1']).toEqual([
      { name: 'other.asm', source: '# other\n' }
    ]);

    await picker(other).setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text)
    });
    const restarted = other.waitForEvent('load');
    await importDialog(other).getByRole('button', { name: 'Import', exact: true }).click();
    await restarted;
    await waitForDesktop(other);
    await expect(other.getByRole('dialog')).toHaveCount(0);

    // Sources, open buffers with the unsaved draft, settings, theme, and the stepped program all arrive.
    const stored = await storedData(other);
    const exported = data.storage;
    expect(stored['mars-ts:sources:v1']).toEqual(exported['mars-ts:sources:v1']);
    expect(stored['mars-ts:workspace:v1']).toEqual(exported['mars-ts:workspace:v1']);
    expect(stored['mars-ts:theme:v1']).toBe('dark');
    expect(stored['mars-ts:engine-settings:v1:DelayedBranching']).toBe('true');
    await expect(other).toHaveTitle('program.asm - MARS');
    await expect(action(other, '* other.asm')).toHaveCount(0);
    await expect(other.getByRole('switch', { name: 'Dark theme', exact: true })).toBeChecked();
    await expect(action(other, 'Show line numbers')).toHaveAttribute('aria-pressed', 'false');
    await expect(other.getByTestId('footer-source')).toHaveText('Loaded: program.asm');
    await expect(other.getByLabel('Execution status')).toHaveText('Status: paused');
    await expect(other.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
    await action(other, 'Step').click();
    await expect(other.getByLabel('$t1 value', { exact: true })).toHaveValue('0x00000009');
    await other.getByTestId('menu-settings-trigger').click();
    await expect(
      other
        .getByTestId('menu-settings-content')
        .getByRole('checkbox', { name: 'Delayed branching', exact: true })
    ).toBeChecked();
    await other.getByTestId('menu-settings-trigger').click();
    await action(other, 'Edit').click();
    await action(other, '* mips1.asm').click();
    await expect(other.getByRole('textbox', { name: 'Source mips1.asm', exact: true })).toHaveValue(
      '# unsaved draft\n'
    );
    // Only the imported library remains: the profile's earlier source is gone.
    await action(other, 'Open ...').click();
    const open = other.getByRole('dialog', { name: 'Open', exact: true });
    await expect(open.getByRole('checkbox')).toHaveCount(1);
    await expect(open.getByRole('checkbox', { name: 'program.asm', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('Import MARS rejects a file that does not conform to the schema and changes nothing', async ({
  page
}) => {
  const { data } = await exportedData(page);
  const before = await storedData(page);
  const invalid = structuredClone(data);
  invalid.version = 2;
  invalid.storage['mars-ts:theme:v1'] = 'sepia';
  invalid.storage['mars-ts:sources:v1'] = [{ name: 'program.asm' }];
  invalid.storage['mars-ts:other:v1'] = {};
  await picker(page).setInputFiles({
    name: 'edited.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalid))
  });
  const dialog = importDialog(page);
  await expect(dialog).toContainText(
    'edited.json is not a MARS data file this version can import. Nothing was changed.'
  );
  await expect(
    dialog.getByRole('list', { name: 'Problems', exact: true }).getByRole('listitem')
  ).toHaveText([
    '/version must be 1.',
    '/storage/mars-ts:sources:v1/0 must have property "source".',
    '/storage/mars-ts:theme:v1 must be one of "light", "dark".',
    '/storage must not have property "mars-ts:other:v1".'
  ]);
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  // A schema-conforming payload still fails when a record owner cannot load it.
  const duplicate = structuredClone(data);
  duplicate.storage['mars-ts:sources:v1'] = [
    { name: 'program.asm', source: '' },
    { name: './program.asm', source: '' }
  ];
  await picker(page).setInputFiles({
    name: 'duplicate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(duplicate))
  });
  await expect(dialog.getByRole('list', { name: 'Problems', exact: true })).toHaveText(
    '/storage/mars-ts:sources:v1: The saved source library contains duplicate name "program.asm".'
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await picker(page).setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('not json')
  });
  await expect(dialog.getByRole('list', { name: 'Problems', exact: true })).toContainText(
    'The file is not valid JSON'
  );
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await storedData(page)).toEqual(before);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
});

test('Import MARS and Export MARS are unavailable while a program runs', async ({ page }) => {
  await openDesktop(page);
  await action(page, 'New').click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('.text\nli $v0, 5\nsyscall\n');
  await action(page, 'Assemble').click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await expect(action(page, 'Import MARS ...')).toBeDisabled();
  await expect(action(page, 'Export MARS')).toBeDisabled();
  await expect(picker(page)).toBeDisabled();
  await page
    .getByLabel('Toolbar', { exact: true })
    .getByRole('button', { name: 'Stop', exact: true })
    .click();
  await expect(action(page, 'Import MARS ...')).toBeEnabled();
  await expect(action(page, 'Export MARS')).toBeEnabled();
});
