import { test, expect, type Page } from '@playwright/test';
import { openDesktop, waitForDesktop } from './openDesktop.js';

const name = 'Program arguments provided to MIPS program';
const action = (page: Page, label: string) =>
  page.getByRole('button', { name: label, exact: true });
const args = (page: Page) => page.getByRole('textbox', { name: 'Program Arguments:', exact: true });
const register = (page: Page, label: string) =>
  page.getByRole('textbox', { name: `${label} value`, exact: true });
const settings = (page: Page) => page.locator('.menubar summary').filter({ hasText: /^Settings$/ });
const assembled = (page: Page) =>
  expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');

async function source(page: Page, text: string) {
  await action(page, 'New').click();
  await page.getByRole('textbox', { name: /^Source / }).fill(text);
  await action(page, 'Assemble').click();
  await assembled(page);
}

const program = '.text\nmove $s0,$a0\nmove $s1,$a1\nnop\nli $v0,10\nsyscall\n';

test('Args shares its persisted setting with the menu and adds a fixed input row beneath Text Segment', async ({
  page
}) => {
  await openDesktop(page);
  const toggles = page.getByRole('group', { name: 'Display settings', exact: true });
  await expect(toggles.getByRole('button').nth(0)).toHaveAccessibleName('Show Labels Window');
  await expect(toggles.getByRole('button').nth(1)).toHaveAccessibleName(name);
  await expect(action(page, name)).toHaveAttribute('aria-pressed', 'false');
  await source(page, program);
  await expect(args(page)).toHaveCount(0);
  await settings(page).click();
  const menu = page.locator('.settings-menu');
  await expect(menu.getByRole('checkbox').nth(1)).toHaveAccessibleName(name);
  await menu.getByRole('checkbox', { name, exact: true }).check();
  await settings(page).click();
  await assembled(page);
  await expect(action(page, name)).toHaveAttribute('aria-pressed', 'true');
  const text = page.getByRole('region', { name: 'Text Segment', exact: true });
  const heading = (await text.getByRole('heading', { name: 'Text Segment' }).boundingBox())!;
  const input = (await args(page).boundingBox())!;
  const table = (await text.locator('thead').boundingBox())!;
  expect(input.y).toBeGreaterThanOrEqual(heading.y + heading.height);
  expect(input.y + input.height).toBeLessThanOrEqual(table.y);
  expect(input.width).toBeLessThan((await text.boundingBox())!.width / 2);
  const clear = action(page, 'Clear program arguments (argv)');
  await expect(clear).toBeDisabled();
  expect((await clear.boundingBox())!.x).toBeGreaterThanOrEqual(input.x + input.width);
  await args(page).fill('first second');
  await expect(clear).toBeEnabled();
  await args(page).hover();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Arguments provided to program at runtime via $a0 (argc) and $a1 (argv)'
  );
  await action(page, name).click();
  await expect(args(page)).toHaveCount(0);
  await action(page, name).click();
  await expect(args(page)).toHaveValue('first second');
  await page.reload();
  await waitForDesktop(page);
  await expect(action(page, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(args(page)).toHaveValue('first second');
  await assembled(page);
  await clear.click();
  await expect(args(page)).toHaveValue('');
  await expect(clear).toBeDisabled();
  await assembled(page);
  await expect(action(page, name)).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await waitForDesktop(page);
  await expect(args(page)).toHaveValue('');
  await expect(clear).toBeDisabled();
});

test('Step installs arguments once; Backstep and reload preserve applied arguments while Reset uses the new draft', async ({
  page
}) => {
  await openDesktop(page);
  await action(page, name).click();
  await source(page, program);
  await args(page).fill('one two');
  await action(page, 'Step').click();
  await expect(register(page, '$s0')).toHaveValue('0x00000002');
  await args(page).fill('replacement');
  await action(page, 'Backstep').click();
  await expect(register(page, '$a0')).toHaveValue('0x00000002');
  await expect(register(page, '$s0')).toHaveValue('0x00000000');
  await page.reload();
  await waitForDesktop(page);
  await expect(args(page)).toHaveValue('replacement');
  await action(page, 'Step').click();
  await expect(register(page, '$s0')).toHaveValue('0x00000002');
  await action(page, 'Reset').click();
  await expect(register(page, '$a0')).toHaveValue('0x00000000');
  await action(page, 'Step').click();
  await expect(register(page, '$s0')).toHaveValue('0x00000001');
});

test('Go passes literal quote characters and whitespace-separated argv strings to the program', async ({
  page
}) => {
  await openDesktop(page);
  await action(page, name).click();
  await source(
    page,
    '.text\nmove $s0,$a0\nmove $s1,$a1\nlw $a0,0($s1)\nli $v0,4\nsyscall\nli $a0,124\nli $v0,11\nsyscall\nlw $a0,4($s1)\nli $v0,4\nsyscall\nli $v0,10\nsyscall\n'
  );
  await args(page).fill('"one two" third');
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await expect(register(page, '$s0')).toHaveValue('0x00000003');
  await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(
    /"one\|two"/
  );
});

test('turning Args off retains the draft but does not install it after Reset or across reload', async ({
  page
}) => {
  await openDesktop(page);
  await action(page, name).click();
  await source(page, program);
  await args(page).fill('one two');
  await action(page, name).click();
  await assembled(page);
  await page.reload();
  await waitForDesktop(page);
  await expect(action(page, name)).toHaveAttribute('aria-pressed', 'false');
  await expect(args(page)).toHaveCount(0);
  await action(page, 'Step').click();
  await expect(register(page, '$s0')).toHaveValue('0x00000000');
  await action(page, name).click();
  await expect(args(page)).toHaveValue('one two');
  await action(page, 'Step').click();
  await expect(register(page, '$a0')).toHaveValue('0x00000000');
  await action(page, 'Reset').click();
  await action(page, 'Step').click();
  await expect(register(page, '$s0')).toHaveValue('0x00000002');
  await action(page, name).click();
  await action(page, 'Reset').click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  for (const label of ['$a0', '$a1', '$s0', '$s1'])
    await expect(register(page, label)).toHaveValue('0x00000000');
  await action(page, name).click();
  await expect(args(page)).toHaveValue('one two');
});

test('Args toggle is disabled while running and the draft survives pane changes', async ({
  page
}) => {
  await openDesktop(page);
  await action(page, name).click();
  await source(page, '.text\nloop: b loop\nnop\n');
  await args(page).fill('one');
  await action(page, 'Go').click();
  await expect(action(page, name)).toBeDisabled();
  await settings(page).click();
  await expect(
    page.locator('.settings-menu').getByRole('checkbox', { name, exact: true })
  ).toBeDisabled();
  await settings(page).click();
  await args(page).fill('next run');
  await action(page, 'Pause').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await action(page, 'Edit').click();
  await action(page, 'Execute').click();
  await expect(args(page)).toHaveValue('next run');
  await expect(action(page, name)).toBeEnabled();
});
