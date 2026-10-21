import { expect, test } from '@playwright/test';
import { openDesktop, waitForDesktop } from './openDesktop.js';

test('Registers switch hides the pane and divider, fills the workspace, and preserves width and machine across reload', async ({
  page
}) => {
  await openDesktop(page);
  const toggle = page.getByRole('switch', { name: 'Register banks', exact: true });
  const theme = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const toggleBox = (await toggle.boundingBox())!;
  const themeBox = (await theme.boundingBox())!;
  expect(toggleBox.x + toggleBox.width).toBeLessThan(themeBox.x);
  const divider = page.getByRole('separator', { name: 'Register panel width', exact: true });
  await divider.press('ArrowLeft');
  await divider.press('ArrowLeft');
  const width = await divider.getAttribute('aria-valuenow');
  const rightWidth = (await page.locator('.register-pane').boundingBox())!.width;
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('.text\nli $t0, 19\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const leftWidth = (await page.locator('.left-panes').boundingBox())!.width;
  await page.mouse.move(5, 250);
  const activeFill = await toggle.evaluate((node) => getComputedStyle(node).backgroundColor);
  const widths = await toggle.evaluate(async (node) => {
    const left = document.querySelector('.left-panes')!;
    const widths = [left.getBoundingClientRect().width];
    (node as HTMLButtonElement).click();
    await new Promise<void>((resolve) => {
      const started = performance.now();
      const sample = () => {
        widths.push(left.getBoundingClientRect().width);
        if (performance.now() - started < 350) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return widths;
  });
  expect(widths.some((width) => width > widths[0] + 2 && width < widths.at(-1)! - 2)).toBe(true);
  await page.mouse.move(5, 250);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).not.toHaveCSS('background-color', activeFill);
  await expect(page.locator('.register-pane')).toHaveCount(0);
  await expect(divider).toHaveCount(0);
  expect((await page.locator('.left-panes').boundingBox())!.width).toBeGreaterThan(
    leftWidth + rightWidth - 2
  );
  await page.reload();
  await waitForDesktop(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.register-pane')).toHaveCount(0);
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  await toggle.click();
  await expect(page.locator('.register-pane')).toBeVisible();
  await expect(divider).toHaveAttribute('aria-valuenow', width!);
  expect((await page.locator('.register-pane').boundingBox())!.width).toBe(rightWidth);
  await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000013');
  await theme.click();
  await page.mouse.move(5, 250);
  const darkActive = await toggle.evaluate((node) => getComputedStyle(node).backgroundColor);
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).not.toHaveCSS('background-color', darkActive);
  await toggle.press('Space');
  await expect(divider).toHaveAttribute('aria-valuenow', width!);
});

test('register Name cells describe their legacy roles in all three banks', async ({ page }) => {
  await openDesktop(page);
  const pane = page.locator('.register-pane');
  for (const [bank, descriptions] of [
    [
      'Registers',
      [
        ['$zero', 'constant 0'],
        ['$at', 'reserved for assembler'],
        ['$v0', 'expression evaluation and results of a function'],
        ['$a3', 'argument 4'],
        ['$t8', 'temporary (not preserved across call)'],
        ['$s7', 'saved temporary (preserved across call)'],
        ['$k1', 'reserved for OS kernel'],
        ['$gp', 'pointer to global area'],
        ['$sp', 'stack pointer'],
        ['$fp', 'frame pointer'],
        ['$ra', 'return address (used by function call)'],
        ['pc', 'program counter'],
        ['hi', 'high-order word of multiply product, or divide remainder'],
        ['lo', 'low-order word of multiply product, or divide quotient']
      ]
    ],
    [
      'Coproc 0',
      [
        ['$8 (vaddr)', 'Memory address at which address exception occurred'],
        ['$12 (status)', 'Interrupt mask and enable bits'],
        ['$13 (cause)', 'Exception type and pending interrupt bits'],
        ['$14 (epc)', 'Address of instruction that caused exception']
      ]
    ],
    [
      'Coproc 1',
      [
        ['$f0', 'floating point subprogram return value'],
        ['$f1', 'should not be referenced explicitly in your program'],
        ['$f4', 'temporary (not preserved across call)'],
        ['$f12', 'floating point subprogram argument 1'],
        ['$f14', 'floating point subprogram argument 2'],
        ['$f30', 'saved temporary (preserved across call)'],
        ['$f31', 'should not be referenced explicitly in your program']
      ]
    ]
  ] as const) {
    await pane.getByRole('button', { name: bank, exact: true }).click();
    for (const [name, description] of descriptions) {
      const entry = pane.getByRole('cell', { name, exact: true }).locator('span');
      await expect(entry).toHaveCSS('cursor', 'pointer');
      await entry.hover();
      await expect(page.getByRole('tooltip')).toHaveText(description);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    }
    await pane.getByRole('columnheader', { name: 'Name', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  }
});

test('Coproc 1 condition flags carry the legacy panel and checkbox descriptions', async ({
  page
}) => {
  await openDesktop(page);
  const pane = page.locator('.register-pane');
  await pane.getByRole('button', { name: 'Coproc 1', exact: true }).click();
  await pane.getByText('Condition flags', { exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText(
    'flags are used by certain floating point instructions, default flag is 0'
  );
  await page.keyboard.press('Escape');
  await pane.getByRole('checkbox', { name: 'Condition flag 5', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('checked == 1, unchecked == 0');
});

test('Coproc 1 condition flag edits drive branches and are undone by Backstep', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('.text\nbc1t taken\nli $t0, 1\ntaken: li $t1, 2\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  const pane = page.locator('.register-pane');
  await pane.getByRole('button', { name: 'Coproc 1', exact: true }).click();
  const flag = pane.getByRole('checkbox', { name: 'Condition flag 0', exact: true });
  await expect(flag).toBeEnabled();
  await flag.check();
  await expect(flag).toBeChecked();
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await pane.getByRole('button', { name: 'Registers', exact: true }).click();
  await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400008');
  await page.getByRole('button', { name: 'Backstep', exact: true }).click();
  await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400000');
  await pane.getByRole('button', { name: 'Coproc 1', exact: true }).click();
  await expect(flag).toBeChecked();
  await page.getByRole('button', { name: 'Backstep', exact: true }).click();
  await expect(flag).not.toBeChecked();
  await pane.getByRole('button', { name: 'Registers', exact: true }).click();
  await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400000');
});

test('Coproc 1 condition flags stay editable while the program runs', async ({ page }) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill('.text\nwait: bc1f wait\nli $t0, 7\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  const pane = page.locator('.register-pane');
  await pane.getByRole('button', { name: 'Coproc 1', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await pane.getByRole('checkbox', { name: 'Condition flag 0', exact: true }).check();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  await pane.getByRole('button', { name: 'Registers', exact: true }).click();
  await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
});
