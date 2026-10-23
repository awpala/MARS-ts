import { expect, test } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

test('repository link opens a new tab and releases mouse tooltip while preserving keyboard help', async ({
  page,
  context
}) => {
  await context.route('https://github.com/awpala/MARS-ts', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Repository</title>' })
  );
  await openDesktop(page);
  const link = page.getByRole('link', { name: 'MARS-ts on GitHub (opens in a new tab)' });
  await expect(link.locator('.github-icon')).toHaveCSS('mask-image', /\/icons\/GitHub\.svg/);
  expect((await page.request.get('/icons/GitHub.svg')).ok()).toBe(true);
  const theme = page.getByRole('switch', { name: 'Dark theme' });
  const tooltip = page.locator('.tooltip');
  const themeBounds = (await theme.boundingBox())!;
  const linkBounds = (await link.boundingBox())!;
  expect(linkBounds.x).toBeGreaterThan(themeBounds.x + themeBounds.width);
  await link.hover();
  await expect(tooltip).toBeVisible();
  const opened = page.waitForEvent('popup');
  await link.click();
  const repository = await opened;
  await expect(repository).toHaveURL('https://github.com/awpala/MARS-ts');
  await repository.close();
  await page.bringToFront();
  await page.mouse.move(5, 200);
  await expect(tooltip).toBeHidden();
  await theme.focus();
  await theme.press('Tab');
  await expect(link).toBeFocused();
  await expect(link).toHaveAccessibleDescription('MARS-ts on GitHub (opens in a new tab)');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
});

test('tooltips support disabled controls, hover, focus, dismissal, themes, and keycaps', async ({
  page
}) => {
  await openDesktop(page);
  const tooltip = page.locator('.tooltip');
  const step = page.getByRole('button', { name: 'Step', exact: true });
  await expect(step).toBeDisabled();
  await step.hover();
  await expect(tooltip).toBeVisible();
  await expect(step).toHaveAccessibleDescription('Step F7');
  await expect(step).not.toHaveAttribute('title');
  // Moving into an adjacent control must remove the old description in the same update.
  const remaining = await step.evaluate(async (element) => {
    element.dispatchEvent(
      new PointerEvent('pointerleave', { relatedTarget: element.parentElement })
    );
    await Promise.resolve();
    return document.querySelectorAll('.tooltip').length;
  });
  expect(remaining).toBe(0);
  await page.mouse.move(5, 200);
  await step.hover();
  await expect(tooltip).toBeVisible();
  const triggerBounds = (await step.boundingBox())!;
  const tooltipBounds = (await tooltip.boundingBox())!;
  await page.mouse.move(
    triggerBounds.x + triggerBounds.width / 2,
    triggerBounds.y + triggerBounds.height - 1
  );
  await page.mouse.move(tooltipBounds.x + tooltipBounds.width / 2, tooltipBounds.y + 1, {
    steps: 12
  });
  await expect(tooltip).toBeHidden();
  await page.mouse.move(5, 200);
  await expect(tooltip).toBeHidden();

  const create = page.getByRole('button', { name: 'New', exact: true });
  await create.focus();
  await expect(create).toHaveAccessibleDescription('New Alt+N / Option+N');
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(create).toBeFocused();

  await page
    .locator('.menubar summary')
    .filter({ hasText: /^File$/ })
    .click();
  const save = page
    .locator('details[open]')
    .getByRole('button', { name: 'Save Ctrl+S', exact: true });
  await expect(save.locator('kbd')).toHaveText(['Ctrl', 'S']);
  await page.keyboard.press('Escape');
  await page.getByRole('switch', { name: 'Dark theme' }).click();
  await create.hover();
  await expect(tooltip).toHaveCSS('background-color', 'rgb(52, 59, 50)');
  await expect(tooltip.locator('kbd').first()).toHaveCSS('background-color', 'rgb(22, 30, 39)');

  await page.setViewportSize({ width: 800, height: 600 });
  const theme = page.getByRole('switch', { name: 'Dark theme' });
  await theme.hover();
  await expect(tooltip).toBeVisible();
  const bounds = (await tooltip.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(792);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(592);
  await page.screenshot({ path: '__build/venus-tooltip-dark.png' });
});

test('keyboard commands work in text inputs and respect disabled commands and dialogs', async ({
  page
}) => {
  await openDesktop(page);
  await page.keyboard.press('Alt+n');
  const source = page.getByRole('textbox', { name: /^Source / });
  await source.fill('.text\nloop: addiu $t0,$t0,1\nb loop\n');
  await source.press('F3');
  const breakpoint = page.getByLabel('Breakpoint 0x00400004', { exact: true });
  const toggle = page.getByRole('button', { name: 'Toggle all breakpoints', exact: true });
  const clear = page.getByRole('button', { name: 'Clear all breakpoints', exact: true });
  await breakpoint.check();
  await breakpoint.press('Control+t');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(breakpoint).toBeChecked();
  await toggle.press('Meta+t');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.press('Control+Shift+t');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('$t0 value', { exact: true }).press('Control+k');
  await expect(breakpoint).not.toBeChecked();
  await breakpoint.check();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(breakpoint).toBeChecked();
  await page.keyboard.press('Escape');
  await toggle.press('Control+t');
  await page.getByLabel('$t0 value', { exact: true }).press('F5');
  await expect(toggle).toBeDisabled();
  await page.keyboard.press('Control+k');
  await expect(breakpoint).toBeChecked();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(clear).toBeEnabled();
  await clear.press('Control+k');
  await expect(breakpoint).not.toBeChecked();
  await expect(clear).toBeDisabled();
});

test('file multiselect supports label clicks, keyboard deselection, and native submit buttons', async ({
  page
}) => {
  await openDesktop(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'mars-ts:sources:v1',
      JSON.stringify([
        { name: 'beta.asm', source: '.text\nnop\n' },
        { name: 'alpha.asm', source: '.text\nnop\n' }
      ])
    )
  );
  await page
    .locator('.menubar summary')
    .filter({ hasText: /^File$/ })
    .click();
  await page.locator('details[open]').getByRole('button', { name: /^Open/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Open', exact: true });
  const group = dialog.getByRole('group', { name: 'Source files stored in this browser' });
  const submit = dialog.getByRole('button', { name: 'Open', exact: true });
  await expect(submit).toBeDisabled();
  await group.getByText('beta.asm', { exact: true }).click();
  await group.getByText('alpha.asm', { exact: true }).click();
  await group.getByRole('checkbox', { name: 'beta.asm' }).press('Space');
  await expect(group.getByRole('checkbox', { name: 'alpha.asm' })).toBeChecked();
  await expect(group.getByRole('checkbox', { name: 'beta.asm' })).not.toBeChecked();
  await submit.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Source alpha.asm' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close beta.asm', exact: true })).toHaveCount(0);
});

test('shared clear buttons retain independent and combined console clearing', async ({ page }) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: /^Source / })
    .fill('.text\nli $a0,7\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  const output = page.getByRole('textbox', { name: 'Run I/O', exact: true });
  await expect(output).toHaveValue(/7\n-- program is finished running --/);
  await page.getByRole('button', { name: 'Mars Messages', exact: true }).click();
  const messages = page.getByRole('textbox', { name: 'Mars Messages', exact: true });
  await expect(messages).not.toHaveValue('');
  await page.getByRole('button', { name: 'Clear', exact: true }).press('Space');
  await expect(messages).toHaveValue('');
  await page.getByRole('button', { name: 'Run I/O', exact: true }).click();
  await expect(output).toHaveValue(/7\n-- program is finished running --/);
  const clearAll = page.getByRole('button', { name: 'Clear All', exact: true });
  await clearAll.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(clearAll).toHaveAccessibleDescription('Clear all outputs Alt+L / Option+L');
  await clearAll.press('Enter');
  await expect(output).toHaveValue('');
  await page.getByRole('button', { name: 'Mars Messages', exact: true }).click();
  await expect(messages).toHaveValue('');
});

test('console shortcuts clear selected or all output while preserving pending input and focus', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByRole('textbox', { name: /^Source / });
  await source.fill('.text\nli $a0,7\nli $v0,1\nsyscall\nli $v0,5\nsyscall\nli $v0,10\nsyscall\n');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Run input', exact: true });
  const output = page.getByRole('textbox', { name: 'Run I/O', exact: true });
  await expect(input).toBeVisible();
  await input.fill('42');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await source.focus();
  // macOS Option+L can report a character rather than the letter L.
  expect(
    await source.evaluate((element) =>
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '¬',
          code: 'KeyL',
          altKey: true,
          bubbles: true,
          cancelable: true
        })
      )
    )
  ).toBe(false);
  await expect(output).toHaveValue('');
  await expect(input).toHaveValue('42');
  await expect(source).toBeFocused();
  await page.getByRole('button', { name: 'Mars Messages', exact: true }).click();
  const messages = page.getByRole('textbox', { name: 'Mars Messages', exact: true });
  await expect(messages).toHaveValue('');
  await page.getByRole('button', { name: 'Run I/O', exact: true }).click();
  await expect(input).toHaveValue('42');
  await input.press('Control+l');
  await expect(output).toHaveValue('');
  await expect(input).toBeFocused();
  await input.press('Enter');
  await expect(input).toHaveCount(0);
  await expect(output).toHaveValue(/program is finished running/);
});

test('both consoles reveal the latest line after overflowing, appending, and switching tabs', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByRole('textbox', { name: /^Source / });
  const lines = Array.from({ length: 80 }, (_, index) => `line ${index}`).join('\\n');
  await source.fill(
    `.data\ntext: .asciiz "${lines}\\n"\n.text\nla $a0,text\nli $v0,4\nsyscall\nli $v0,5\nsyscall\nli $v0,10\nsyscall\n`
  );
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  const output = page.getByRole('textbox', { name: 'Run I/O', exact: true });
  const input = page.getByRole('textbox', { name: 'Run input', exact: true });
  await expect(input).toBeVisible();
  await expect(output).toHaveValue(/line 79\n$/);
  const atBottom = (element: HTMLTextAreaElement) =>
    element.scrollHeight > element.clientHeight &&
    Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 1;
  await expect.poll(() => output.evaluate(atBottom)).toBe(true);
  await output.evaluate((element) => (element.scrollTop = 0));
  await input.fill('42');
  await input.press('Enter');
  await expect(output).toHaveValue(/program is finished running/);
  await expect.poll(() => output.evaluate(atBottom)).toBe(true);
  await output.evaluate((element) => (element.scrollTop = 0));
  await page.getByRole('button', { name: 'Mars Messages', exact: true }).click();
  await page.getByRole('button', { name: 'Run I/O', exact: true }).click();
  await expect.poll(() => output.evaluate(atBottom)).toBe(true);

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await source.fill('.text\n' + 'invalid_instruction\n'.repeat(80));
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  const messages = page.getByRole('textbox', { name: 'Mars Messages', exact: true });
  await expect(messages).toHaveValue(/Error/);
  await expect.poll(() => messages.evaluate(atBottom)).toBe(true);
  await messages.evaluate((element) => (element.scrollTop = 0));
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await expect.poll(() => messages.evaluate(atBottom)).toBe(true);
  await messages.press('Control+l');
  await expect(messages).toHaveValue('');
  await page.getByRole('button', { name: 'Run I/O', exact: true }).click();
  await expect(output).toHaveValue(/program is finished running/);
  await output.press('Alt+l');
  await expect(output).toHaveValue('');
});

test('every defined shortcut cancels browser defaults across app surfaces, including when modal-blocked', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  const canceled = await page.evaluate(async () => {
    const path = '/src/lib/venus/utils/commands/actions.ts';
    const metadata = (await import(
      /* @vite-ignore */ path
    )) as typeof import('../../src/lib/venus/utils/commands/actions.js');
    const actions = [
      ...metadata.fileActions,
      ...metadata.editActions,
      ...metadata.runActions,
      ...metadata.breakpointActions,
      ...metadata.consoleActions,
      ...metadata.helpActions
    ];
    const input = document.createElement('input');
    document.querySelector('dialog[open]')!.append(input);
    const targets = [document.body, document.querySelector('textarea')!, input];
    const results: { shortcut: string; canceled: boolean }[] = [];
    for (const target of targets) {
      for (const action of actions) {
        for (const shortcut of action.shortcut?.split(' / ') ?? []) {
          const keys = shortcut.toLowerCase().split('+');
          results.push({
            shortcut,
            canceled: !target.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: keys.at(-1)!,
                ctrlKey: keys.includes('ctrl'),
                altKey: keys.includes('alt') || keys.includes('option'),
                shiftKey: keys.includes('shift'),
                bubbles: true,
                cancelable: true
              })
            )
          });
        }
      }
    }
    input.remove();
    return results;
  });
  expect(canceled.length).toBeGreaterThan(0);
  expect(canceled.filter((result) => !result.canceled)).toEqual([]);
  await expect(page.getByRole('dialog', { name: 'MARS Help', exact: true })).toBeVisible();
});

test('Alt N creates buffers from console, source, and register focus', async ({ page }) => {
  await openDesktop(page);
  await page.getByRole('textbox', { name: 'Mars Messages', exact: true }).press('Alt+n');
  const first = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
  await expect(first).toBeFocused();
  await first.fill('# retained');
  await first.press('Alt+n');
  await expect(page.getByRole('textbox', { name: 'Source mips2.asm', exact: true })).toBeFocused();
  await page.getByLabel('$t0 value', { exact: true }).press('Alt+n');
  await expect(page.getByRole('textbox', { name: 'Source mips3.asm', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
  await expect(first).toHaveValue('# retained');
});

test('only toggle tooltips remain visible through pointer clicks until hover ends', async ({
  page
}) => {
  await openDesktop(page);
  const tooltip = page.getByRole('tooltip');
  const theme = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await theme.hover();
  await expect(theme).toHaveAccessibleDescription('Switch to dark theme');
  const original = await tooltip.elementHandle();
  await theme.click();
  await expect(theme).toHaveAccessibleDescription('Switch to light theme');
  expect(await original!.isVisible()).toBe(true);
  await theme.click();
  await expect(theme).toHaveAccessibleDescription('Switch to dark theme');
  expect(await original!.isVisible()).toBe(true);
  // Toggle descriptions do not own hover: entering the tooltip itself ends their lifetime.
  const descriptionBounds = (await tooltip.boundingBox())!;
  await page.mouse.move(
    descriptionBounds.x + descriptionBounds.width / 2,
    descriptionBounds.y + descriptionBounds.height / 2,
    { steps: 12 }
  );
  await expect(tooltip).toHaveCount(0);
  expect(await original!.isVisible()).toBe(false);

  const banks = page.getByRole('switch', { name: 'Register banks', exact: true });
  await banks.hover();
  await expect(banks).toHaveAccessibleDescription('Hide register banks');
  await banks.click();
  await expect(banks).toHaveAccessibleDescription('Show register banks');
  await expect(tooltip).toBeVisible();
  await page.mouse.move(5, 200);
  await expect(tooltip).toHaveCount(0);

  const create = page.getByRole('button', { name: 'New', exact: true });
  await create.hover();
  await expect(tooltip).toBeVisible();
  await create.click();
  await expect(tooltip).toHaveCount(0);
  await page
    .getByRole('textbox', { name: /^Source / })
    .fill(
      '.data\n' +
        Array.from({ length: 60 }, (_, i) => `item${i}: .word ${i}`).join('\n') +
        '\n.text\nmain: nop\n'
    );
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  const labelsToggle = page.getByRole('button', { name: 'Show Labels Window', exact: true });
  await labelsToggle.hover();
  await expect(tooltip).toBeVisible();
  const toolbarDescription = await tooltip.elementHandle();
  await labelsToggle.click();
  await expect(labelsToggle).toHaveAttribute('aria-pressed', 'true');
  expect(await toolbarDescription!.isVisible()).toBe(true);
  await page.mouse.move(5, 200);
  await expect(tooltip).toHaveCount(0);

  const labels = page.getByRole('region', { name: 'Labels', exact: true });
  await labels
    .locator('.labels-scroll')
    .evaluate((element) => (element.scrollTop = element.scrollHeight));
  const data = labels.getByRole('checkbox', { name: 'Data', exact: true });
  await data.hover();
  await expect(data).toHaveAccessibleDescription('Show labels defined in the data segment');
  const checkboxDescription = await tooltip.elementHandle();
  await data.click();
  await expect(data).not.toBeChecked();
  expect(await checkboxDescription!.isVisible()).toBe(true);
  await page.mouse.move(5, 200);
  await expect(tooltip).toHaveCount(0);

  // Pressed navigation controls are selections, not binary toggles.
  const textLabel = labels.getByRole('button', { name: 'main', exact: true });
  await textLabel.hover();
  await expect(tooltip).toBeVisible();
  await textLabel.click();
  await expect(textLabel).toHaveAttribute('aria-pressed', 'true');
  await expect(tooltip).toHaveCount(0);
});
