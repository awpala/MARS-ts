import { test, expect, type Page } from '@playwright/test';
import { openDesktop, waitForDesktop } from './openDesktop.js';

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
  expect(await items.count()).toBe(14);
  for (const item of await items.all()) {
    await item.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).not.toHaveText('');
    if ((await item.textContent())?.includes('Clear all outputs on Go'))
      await expect(tooltip).toHaveText(
        'If set, clear Mars Messages and Run I/O before each Go, including resume.'
      );
    if ((await item.textContent())?.includes('Delayed branching'))
      await expect(tooltip).toHaveText(
        'If set, delayed branching will occur during MIPS execution.'
      );
    await settings(page).hover();
    await expect(tooltip).toHaveCount(0);
  }
});

test('machine settings cannot be changed during execution', async ({ page }) => {
  await openDesktop(page);
  await source(page, '.text\nloop: b loop\nnop\n');
  await action(page, 'Go').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await settings(page).click();
  for (const name of ['Delayed branching', 'Self-modifying code'])
    await expect(menu(page).getByRole('checkbox', { name, exact: true })).toBeDisabled();
  await expect(
    menu(page).getByRole('button', { name: 'Memory Configuration ...', exact: true })
  ).toBeDisabled();
  await settings(page).click();
  await action(page, 'Pause').click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await openMemory(page);
  await memoryDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
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

test('memory dialog keeps columns aligned and actions visible in short viewports', async ({
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
  expect(Math.abs(right.y - left.y)).toBeLessThan(2);
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
