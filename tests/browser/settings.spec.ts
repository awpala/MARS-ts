import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';
import { readArchive } from './archive.js';

const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const menu = (page: Page) => page.locator('.settings-menu');
const settings = (page: Page) => page.locator('.menubar summary').filter({ hasText: /^Settings$/ });
const memoryDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'MIPS Memory Configuration' });

async function openMemory(page: Page) {
  await settings(page).click();
  await menu(page).getByRole('button', { name: 'Memory Configuration ...', exact: true }).click();
  await expect(memoryDialog(page)).toBeVisible();
}

async function source(page: Page, text: string) {
  await action(page, 'New').click();
  await page.getByRole('textbox', { name: /^Source / }).fill(text);
  await action(page, 'Assemble').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
}

async function setting(page: Page, name: string, value: boolean) {
  await settings(page).click();
  await menu(page).getByRole('checkbox', { name, exact: true }).setChecked(value);
  await settings(page).click();
}

const register = (page: Page, name: string) =>
  page.getByRole('textbox', { name: `${name === '$pc' ? 'pc' : name} value`, exact: true });

test('memory settings preview, apply, opening-selection reset, cancel, and persist without a source', async ({
  page
}) => {
  await openDesktop(page);
  await openMemory(page);
  const dialog = memoryDialog(page);
  await expect(dialog.getByRole('radio', { name: 'Default', exact: true })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Compact, Data at Address 0', exact: true }).check();
  await expect(dialog.getByRole('row').filter({ hasText: '.text base address' })).toContainText(
    '0x00003000'
  );
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openMemory(page);
  await expect(dialog.getByRole('radio', { name: 'Default', exact: true })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Compact, Data at Address 0', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Default', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openMemory(page);
  await expect(
    dialog.getByRole('radio', { name: 'Compact, Data at Address 0', exact: true })
  ).toBeChecked();
  await dialog.getByRole('radio', { name: 'Compact, Text at Address 0', exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await openMemory(page);
  await expect(
    dialog.getByRole('radio', { name: 'Compact, Data at Address 0', exact: true })
  ).toBeChecked();
});

for (const [name, address, stack] of [
  ['Compact, Data at Address 0', '0x00003000', '0x00002ffc'],
  ['Compact, Text at Address 0', '0x00000000', '0x00003ffc'],
  ['Default', '0x00400000', '0x7fffeffc']
]) {
  test(`applying ${name} rebuilds loaded code and survives checkpoint recovery`, async ({
    page
  }) => {
    await openDesktop(page);
    if (name === 'Default') {
      await openMemory(page);
      await memoryDialog(page)
        .getByRole('radio', { name: 'Compact, Data at Address 0', exact: true })
        .check();
      await memoryDialog(page).getByRole('button', { name: 'Apply and Close' }).click();
    }
    await source(page, '.data\nvalue: .word 42\n.text\nlw $t0,value\nli $v0,10\nsyscall\n');
    await action(page, 'Step').click();
    await openMemory(page);
    await memoryDialog(page).getByRole('radio', { name, exact: true }).check();
    await memoryDialog(page).getByRole('button', { name: 'Apply and Close' }).click();
    await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
    await expect(register(page, '$pc')).toHaveValue(address);
    await expect(register(page, '$sp')).toHaveValue(stack);
    await expect(register(page, '$t0')).toHaveValue('0x00000000');
    await page.reload();
    await waitForDesktop(page);
    await expect(register(page, '$pc')).toHaveValue(address);
    await action(page, 'Go').click();
    await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
    await expect(register(page, '$t0')).toHaveValue('0x0000002a');
    await openMemory(page);
    await memoryDialog(page).getByRole('button', { name: 'Apply and Close' }).click();
    await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  });
}

test('delayed branching defaults off, reassembles on change, executes the slot, and persists', async ({
  page
}) => {
  await openDesktop(page);
  await settings(page).click();
  await expect(
    menu(page).getByRole('checkbox', { name: 'Delayed branching', exact: true })
  ).not.toBeChecked();
  await expect(
    menu(page).getByRole('checkbox', { name: 'Self-modifying code', exact: true })
  ).not.toBeChecked();
  await settings(page).click();
  await source(page, '.text\nb target\naddiu $t0,$zero,7\ntarget: li $v0,10\nsyscall\n');
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await expect(register(page, '$t0')).toHaveValue('0x00000000');
  await setting(page, 'Delayed branching', true);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await action(page, 'Step').click();
  await action(page, 'Step').click();
  await expect(register(page, '$t0')).toHaveValue('0x00000007');
  await action(page, 'Backstep').click();
  await expect(register(page, '$t0')).toHaveValue('0x00000000');
  await page.reload();
  await waitForDesktop(page);
  await settings(page).click();
  await expect(
    menu(page).getByRole('checkbox', { name: 'Delayed branching', exact: true })
  ).toBeChecked();
  await settings(page).click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await expect(register(page, '$t0')).toHaveValue('0x00000007');
  await setting(page, 'Delayed branching', false);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await expect(register(page, '$t0')).toHaveValue('0x00000000');
});

test('self-modifying code enables text writes and data execution without resetting the program', async ({
  page
}) => {
  await openDesktop(page);
  await source(
    page,
    '.data\ncode: .word 0x2408002a,0x2402000a,0x0000000c\n.text\nla $t1,patch\nsw $zero,0($t1)\npatch: addiu $t0,$zero,1\nla $t1,code\njr $t1\nnop\n'
  );
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
  await action(page, 'Reset').click();
  await action(page, 'Step').click();
  const pc = await register(page, '$pc').inputValue();
  await setting(page, 'Self-modifying code', true);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await expect(register(page, '$pc')).toHaveValue(pc);
  await page.reload();
  await waitForDesktop(page);
  await settings(page).click();
  await expect(
    menu(page).getByRole('checkbox', { name: 'Self-modifying code', exact: true })
  ).toBeChecked();
  await settings(page).click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await expect(register(page, '$t0')).toHaveValue('0x0000002a');
});

test('every Settings item has a themed description, including disabled settings and Clear all outputs on Go', async ({
  page
}) => {
  await openDesktop(page);
  await settings(page).click();
  const items = menu(page).locator('label, button');
  expect(await items.count()).toBe(15);
  for (const item of await items.all()) {
    await item.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).not.toHaveText('');
    if ((await item.textContent())?.includes('Clear all outputs on Go'))
      await expect(tooltip).toHaveText(
        'If set, clear Mars Messages and Run I/O when Go starts a fresh program run; resuming preserves output.'
      );
    if ((await item.textContent())?.includes('Prompt to clear all breakpoints'))
      await expect(tooltip).toHaveText(
        'If set, ask for confirmation before Clear all breakpoints removes them; otherwise clear immediately.'
      );
    if ((await item.textContent())?.includes('Delayed branching'))
      await expect(tooltip).toHaveText(
        'If set, delayed branching will occur during MIPS execution.'
      );
    await settings(page).hover();
    await expect(tooltip).toHaveCount(0);
  }
});

test('execution settings are guarded while exception-handler preferences stay available', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    [
      { name: 'handler.asm', source: '.ktext 0x80000180\nnop\n' },
      { name: 'loop.asm', source: '.text\nloop: b loop\nnop\n' }
    ],
    ['loop.asm']
  );
  await action(page, 'Assemble').click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await expect(
    page
      .getByRole('group', { name: 'Display settings', exact: true })
      .getByRole('button', { name: 'Memory Configuration ...', exact: true })
  ).toBeDisabled();
  await expect(
    page
      .getByRole('group', { name: 'Execution actions', exact: true })
      .getByRole('button', { name: 'Exception Handler ...', exact: true })
  ).toBeEnabled();
  await settings(page).click();
  for (const name of ['Delayed branching', 'Self-modifying code'])
    await expect(menu(page).getByRole('checkbox', { name, exact: true })).toBeDisabled();
  await expect(
    menu(page).getByRole('button', { name: 'Memory Configuration ...', exact: true })
  ).toBeDisabled();
  await menu(page).getByRole('button', { name: 'Exception Handler ...', exact: true }).click();
  const handler = page.getByRole('dialog', { name: 'Exception Handler', exact: true });
  await expect(handler).toBeVisible();
  await setHandlerEnabled(page, true);
  await chooseHandler(page, 'handler.asm');
  await handler.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await page.reload();
  await waitForDesktop(page);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await openExceptionHandler(page);
  await expect(handler.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(handler.getByRole('status')).toHaveText('handler.asm');
  await handler.getByRole('button', { name: 'Cancel', exact: true }).click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await action(page, 'Pause').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await openMemory(page);
  await memoryDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
});

const exceptionDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Exception Handler', exact: true });
const browseDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Select Exception Handler', exact: true });

async function openExceptionHandler(page: Page) {
  await settings(page).click();
  await menu(page).getByRole('button', { name: 'Exception Handler ...', exact: true }).click();
  await expect(exceptionDialog(page)).toBeVisible();
}

async function setHandlerEnabled(page: Page, enabled: boolean) {
  const toggle = exceptionDialog(page).getByRole('switch', {
    name: 'Enable exception handler',
    exact: true
  });
  if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) await toggle.click();
}

async function chooseHandler(page: Page, name: string) {
  await exceptionDialog(page).getByRole('button', { name: 'Browse', exact: true }).click();
  await browseDialog(page).getByRole('radio', { name, exact: true }).check();
  await browseDialog(page).getByRole('button', { name: 'Open', exact: true }).click();
}

test('exception handler selection and enablement persist independently across toggles and reloads', async ({
  page
}) => {
  await openDesktop(page);
  await openExceptionHandler(page);
  const dialog = exceptionDialog(page);
  const toggle = dialog.getByRole('switch', { name: 'Enable exception handler', exact: true });
  const filename = dialog.getByRole('status', { name: 'Exception handler source' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(filename).toHaveText('No file selected');
  await expect(dialog.getByRole('button', { name: 'Browse', exact: true })).toBeDisabled();
  const spim = dialog.getByRole('radio', {
    name: 'Use SPIM default exceptions handler',
    exact: true
  });
  const custom = dialog.getByRole('radio', { name: 'Use a custom exception handler', exact: true });
  await expect(spim).toBeDisabled();
  await expect(custom).toBeDisabled();
  await expect(custom.locator('..')).toHaveCSS('opacity', '0.5');
  await setHandlerEnabled(page, true);
  await expect(spim).toBeEnabled();
  await expect(custom).toBeEnabled();
  await spim.check();
  await expect(dialog.getByRole('button', { name: 'Browse', exact: true })).toHaveCount(0);
  await expect(filename).toHaveCount(0);
  await setHandlerEnabled(page, false);
  await expect(spim).toBeChecked();
  await expect(spim).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Browse', exact: true })).toHaveCount(0);
  await setHandlerEnabled(page, true);
  await custom.check();
  await expect(dialog.getByRole('button', { name: 'Browse', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(browseDialog(page)).toContainText('No saved files yet. Create a source or import');
  await expect(
    browseDialog(page).getByRole('button', { name: 'Open', exact: true })
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await action(page, 'New').click();
  await page.getByRole('textbox', { name: /^Source / }).fill('# never saved');
  await openStoredSources(
    page,
    [
      { name: 'z.asm', source: 'nop\n' },
      { name: 'a.asm', source: '.ktext 0x80000180\nnop\n' },
      { name: 'A.asm', source: 'nop\n' }
    ],
    ['z.asm']
  );
  await openExceptionHandler(page);
  await setHandlerEnabled(page, true);
  await dialog.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(browseDialog(page).getByRole('radio')).toHaveCount(3);
  await expect(browseDialog(page).locator('label span')).toHaveText(['A.asm', 'a.asm', 'z.asm']);
  await browseDialog(page).getByRole('radio', { name: 'a.asm', exact: true }).check();
  await browseDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(filename).toHaveText('No file selected');
  await chooseHandler(page, 'a.asm');
  await expect(filename).toHaveText('a.asm');
  await setHandlerEnabled(page, true);
  await setHandlerEnabled(page, false);
  await expect(filename).toHaveText('a.asm');
  await page.keyboard.press('Escape');
  await openExceptionHandler(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(filename).toHaveText('No file selected');
  await setHandlerEnabled(page, true);
  await chooseHandler(page, 'a.asm');
  await setHandlerEnabled(page, false);
  await expect(spim).toBeDisabled();
  await expect(custom).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Browse', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openExceptionHandler(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(filename).toHaveText('a.asm');
  await setHandlerEnabled(page, true);
  await expect(filename).toHaveText('a.asm');
  await chooseHandler(page, 'z.asm');
  await expect(filename).toHaveText('z.asm');
  await dialog.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(browseDialog(page).getByRole('radio', { name: 'z.asm', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await setHandlerEnabled(page, false);
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openExceptionHandler(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(filename).toHaveText('z.asm');
  await setHandlerEnabled(page, true);
  await expect(filename).toHaveText('z.asm');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openExceptionHandler(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(filename).toHaveText('z.asm');
  await setHandlerEnabled(page, false);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await openExceptionHandler(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('automatic handler assembly uses working text, reports handler first, and recovers trap and eret execution', async ({
  page
}) => {
  await openDesktop(page);
  const handler =
    '.ktext 0x80000180\naddiu $t0,$zero,42\nmfc0 $k0,$14\naddiu $k0,$k0,4\nmtc0 $k0,$14\neret\n';
  await openStoredSources(page, [
    { name: 'handler.asm', source: handler },
    { name: 'lead.asm', source: '.text\nteqi $zero,0\naddiu $t1,$zero,7\nli $v0,10\nsyscall\n' }
  ]);
  await page.getByRole('button', { name: 'handler.asm', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source handler.asm', exact: true })
    .fill(handler.replace('42', '43'));
  await page.getByRole('button', { name: 'lead.asm', exact: true }).click();
  await openExceptionHandler(page);
  await setHandlerEnabled(page, true);
  await chooseHandler(page, 'handler.asm');
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
  await action(page, 'Assemble').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await expect(page.getByRole('textbox', { name: 'Mars Messages', exact: true })).toHaveValue(
    'Assemble: assembling handler.asm, lead.asm\n\nAssemble: operation completed successfully.\n\n'
  );
  await action(page, 'Step').click();
  await expect(action(page, 'Coproc 0')).toHaveAttribute('aria-pressed', 'true');
  await action(page, 'Registers').click();
  await expect(register(page, '$pc')).toHaveValue('0x80000180');
  await openExceptionHandler(page);
  await setHandlerEnabled(page, false);
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await page.reload();
  await waitForDesktop(page);
  await action(page, 'Registers').click();
  await expect(register(page, '$pc')).toHaveValue('0x80000180');
  await openExceptionHandler(page);
  await expect(exceptionDialog(page).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await exceptionDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await action(page, 'Registers').click();
  await expect(register(page, '$t0')).toHaveValue('0x0000002b');
  await expect(register(page, '$t1')).toHaveValue('0x00000007');
  await action(page, 'Reset').click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await action(page, 'Registers').click();
  await expect(register(page, '$t0')).toHaveValue('0x0000002b');
  await action(page, 'Assemble').click();
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
});

test('missing handler selection is accepted and fails at assembly with the library diagnostic', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    [
      { name: 'handler.asm', source: '.ktext 0x80000180\nnop\n' },
      { name: 'lead.asm', source: 'nop\n' }
    ],
    ['lead.asm']
  );
  await openExceptionHandler(page);
  await setHandlerEnabled(page, true);
  await chooseHandler(page, 'handler.asm');
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
  await page.evaluate(() =>
    localStorage.setItem(
      'mars-ts:sources:v1',
      JSON.stringify([{ name: 'lead.asm', source: 'nop\n' }])
    )
  );
  await action(page, 'Assemble').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
  await expect(page.getByRole('textbox', { name: 'Mars Messages', exact: true })).toHaveValue(
    /Source file "handler\.asm" is not in the source library\./
  );
  await expect(page.getByRole('textbox', { name: 'Mars Messages', exact: true })).toHaveValue(
    /Assemble: operation completed with errors\./
  );
  await expect(page.getByRole('textbox', { name: 'Mars Messages', exact: true })).not.toHaveValue(
    /Assemble: assembling/
  );
  await openExceptionHandler(page);
  await expect(exceptionDialog(page).getByRole('status')).toHaveText('handler.asm');
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
});

test('boolean preferences persist without a loaded program', async ({ page }) => {
  await openDesktop(page);
  for (const name of ['Delayed branching', 'Self-modifying code']) await setting(page, name, true);
  await page.reload();
  await waitForDesktop(page);
  await settings(page).click();
  for (const name of ['Delayed branching', 'Self-modifying code'])
    await expect(menu(page).getByRole('checkbox', { name, exact: true })).toBeChecked();
  await settings(page).click();
  for (const name of ['Delayed branching', 'Self-modifying code']) await setting(page, name, false);
  await page.reload();
  await waitForDesktop(page);
  await settings(page).click();
  for (const name of ['Delayed branching', 'Self-modifying code'])
    await expect(menu(page).getByRole('checkbox', { name, exact: true })).not.toBeChecked();
});

test('memory dialog centers configuration choices and keeps actions visible in short viewports', async ({
  page
}) => {
  await page.setViewportSize({ width: 1100, height: 500 });
  await openDesktop(page);
  await openMemory(page);
  const dialog = memoryDialog(page);
  const choices = dialog.getByRole('group', { name: 'Configuration', exact: true });
  const table = dialog.getByRole('table', { name: 'Memory configuration addresses' });
  const left = (await choices.boundingBox())!;
  const right = (await table.boundingBox())!;
  expect(right.x).toBeGreaterThan(left.x + left.width);
  expect(Math.abs(right.y + right.height / 2 - (left.y + left.height / 2))).toBeLessThan(2);
  for (const name of ['Apply and Close', 'Apply', 'Cancel', 'Reset'])
    await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  const scroller = dialog.locator('.configuration');
  expect(await scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true
  );
  const footer = await dialog.getByRole('button', { name: 'Apply', exact: true }).boundingBox();
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await dialog.getByRole('button', { name: 'Apply', exact: true }).boundingBox()).toEqual(
    footer
  );
  await page.setViewportSize({ width: 500, height: 500 });
  await expect(dialog.getByRole('button', { name: 'Apply and Close' })).toBeInViewport({
    ratio: 1
  });
});

test('changing delayed branching reassembles even an empty loaded program', async ({ page }) => {
  await openDesktop(page);
  await source(page, '.text\n');
  await setting(page, 'Delayed branching', true);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
});

test('toolbar settings shortcuts occupy their groups and the bundled SPIM handler catches a trap', async ({
  page
}) => {
  await openDesktop(page);
  const execution = page.getByRole('group', { name: 'Execution actions', exact: true });
  const display = page.getByRole('group', { name: 'Display settings', exact: true });
  await expect(execution.getByRole('button').last()).toHaveAccessibleName('Exception Handler ...');
  await expect(display.getByRole('button').last()).toHaveAccessibleName('Memory Configuration ...');
  await expect(display.getByRole('button').nth(5)).toHaveAccessibleName(
    'Display Data Segment values as ASCII'
  );
  await display.getByRole('button').last().click();
  await expect(memoryDialog(page)).toBeVisible();
  await memoryDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await execution.getByRole('button').last().click();
  await setHandlerEnabled(page, true);
  await exceptionDialog(page)
    .getByRole('radio', { name: 'Use SPIM default exceptions handler', exact: true })
    .check();
  await setHandlerEnabled(page, true);
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openExceptionHandler(page);
  await expect(
    exceptionDialog(page).getByRole('radio', {
      name: 'Use SPIM default exceptions handler',
      exact: true
    })
  ).toBeChecked();
  await expect(exceptionDialog(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await exceptionDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await source(page, '.globl main\n.text\nmain: teqi $zero,0\nli $t0,42\nli $v0,10\nsyscall\n');
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await action(page, 'Run I/O').click();
  await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(
    /\[Trap\].*occurred and ignored/
  );
  await action(page, 'Registers').click();
  await expect(register(page, '$t0')).toHaveValue('0x0000002a');
  await openExceptionHandler(page);
  await setHandlerEnabled(page, false);
  await exceptionDialog(page).getByRole('button', { name: 'OK', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await openExceptionHandler(page);
  await expect(
    exceptionDialog(page).getByRole('radio', {
      name: 'Use SPIM default exceptions handler',
      exact: true
    })
  ).toBeChecked();
  await expect(exceptionDialog(page).getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

test('bundled handler opens locked, restores canonical text, and copies to an editable new source', async ({
  page
}) => {
  test.setTimeout(120_000);
  await openDesktop(page);
  await source(page, '.text\nli $t0,7\nli $v0,10\nsyscall\n');
  const asset = await page.request.get('/sources/exceptions.s');
  expect(asset.ok()).toBe(true);
  const canonical = await asset.text();
  expect(canonical).toContain('Copyright (c) 1990-2010, James R. Larus.');
  expect(canonical).toBe(
    readFileSync(new URL('../../static/sources/exceptions.s', import.meta.url), 'utf8')
  );
  await openExceptionHandler(page);
  const preview = exceptionDialog(page).getByRole('button', {
    name: 'Open default exceptions.s in editor',
    exact: true
  });
  await expect(preview.locator('code')).toHaveText('exceptions.s');
  await expect(preview.locator('code')).toHaveCSS('font-weight', '700');
  await expect(preview.locator('code')).toHaveCSS('font-family', /monospace/);
  await expect(preview).toBeEnabled();
  await preview.click();
  const referenceTab = action(page, '/SPIM:/exceptions.s (read-only)');
  const reference = page.getByRole('textbox', { name: 'Source /SPIM:/exceptions.s', exact: true });
  await expect(referenceTab).toHaveAttribute('aria-pressed', 'true');
  await expect(referenceTab.locator('[style*="Lock.svg"]')).toHaveCount(1);
  await expect(reference).toHaveAttribute('readonly', '');
  await expect(reference).toHaveValue(canonical);
  await expect(
    page.getByRole('status').filter({ hasText: 'SPIM default exceptions handler — Read-only' })
  ).toBeVisible();
  await expect(action(page, 'Go')).toBeEnabled();
  for (const label of ['Save', 'Save as ...', 'Cut', 'Paste', 'Undo', 'Redo', 'Assemble'])
    await expect(action(page, label)).toBeDisabled();
  await expect(action(page, 'Copy')).toBeEnabled();
  await reference.focus();
  await page.keyboard.press('Tab');
  await reference.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('attempted edit');
  await expect(reference).toHaveValue(canonical);
  await referenceTab.press('F2');
  await expect(page.getByRole('textbox', { name: 'Rename source file' })).toHaveCount(0);
  await action(page, 'Find/Replace').click();
  const find = page.getByRole('dialog', { name: 'Find / Replace', exact: true });
  await find.getByRole('textbox', { name: 'Find', exact: true }).fill('Copyright');
  await find.getByRole('button', { name: 'Find Next', exact: true }).click();
  await expect(find.getByRole('status')).toContainText('Match at character');
  await expect(find.getByRole('button', { name: 'Replace', exact: true })).toBeDisabled();
  await expect(find.getByRole('button', { name: 'Replace All', exact: true })).toBeDisabled();
  await find.getByRole('button', { name: 'Close', exact: true }).click();
  await openExceptionHandler(page);
  await exceptionDialog(page)
    .getByRole('button', { name: 'Open default exceptions.s in editor', exact: true })
    .click();
  await expect(referenceTab).toHaveCount(1);
  await action(page, 'Auto Save').click();
  const exportAll = page.waitForEvent('download');
  await action(page, 'Export All').click();
  const archive = await exportAll;
  expect(readArchive((await archive.path())!).map((entry) => entry.name)).toEqual(['mips1.asm']);
  const exportOne = page.waitForEvent('download');
  await action(page, 'Export').click();
  const exported = await exportOne;
  expect(exported.suggestedFilename()).toBe('exceptions.s');
  expect(readFileSync((await exported.path())!, 'utf8')).toBe(canonical);
  await page.evaluate(() => {
    const key = 'mars-ts:workspace:v1';
    const drafts = JSON.parse(localStorage.getItem(key)!);
    const reference = drafts.find(
      (draft: { name: string }) => draft.name === '/SPIM:/exceptions.s'
    );
    reference.source = 'tampered draft';
    reference.savedSource = 'tampered baseline';
    reference.isNew = true;
    localStorage.setItem(key, JSON.stringify(drafts));
  });
  await page.reload();
  await waitForDesktop(page);
  await expect(reference).toHaveValue(canonical);
  await expect(reference).toHaveAttribute('readonly', '');
  await expect(action(page, 'Save')).toBeDisabled();
  await openMemory(page);
  await memoryDialog(page)
    .getByRole('radio', { name: 'Compact, Data at Address 0', exact: true })
    .check();
  await memoryDialog(page).getByRole('button', { name: 'Apply and Close', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await expect(register(page, '$pc')).toHaveValue('0x00003000');
  await action(page, 'Edit').click();
  await expect(reference).toHaveValue(canonical);
  await action(page, 'Copy to new file').click();
  const copy = page.getByRole('textbox', { name: 'Source mips2.asm', exact: true });
  await expect(copy).not.toHaveAttribute('readonly');
  await expect(copy).toHaveValue(canonical);
  await copy.fill('# modified handler');
  const records = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('mars-ts:sources:v1')!)
  );
  expect(records).toContainEqual({ name: 'mips2.asm', source: '# modified handler' });
  expect(records.some((record: { name: string }) => record.name === '/SPIM:/exceptions.s')).toBe(
    false
  );
  await referenceTab.click();
  await expect(reference).toHaveValue(canonical);
  await action(page, 'Close /SPIM:/exceptions.s').click();
  await expect(referenceTab).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
