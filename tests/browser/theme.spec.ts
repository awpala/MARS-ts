import { expect, test } from '@playwright/test';
import { openDesktop, waitForDesktop } from './openDesktop.js';

test('theme toggle preserves editor and execution state, recolors panes, and persists both choices', async ({
  page
}) => {
  test.setTimeout(90_000);
  await openDesktop(page);
  const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle.locator('.thumb')).toHaveCSS('transition-duration', '0.3s');
  await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(237, 237, 237)');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
  const program = '.text\nli $t0, 42\nli $v0, 10\nsyscall\n';
  await source.fill(program);
  await toggle.focus();
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(toggle.locator('.thumb')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 28, 0)');
  await expect(page.locator('.source-surface')).toHaveCSS('background-color', 'rgb(22, 30, 39)');
  await expect(page.locator('.syntax-layer [data-token="6"]').first()).toHaveCSS(
    'color',
    'rgb(143, 199, 255)'
  );
  await expect(source).toHaveValue(program);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  const range = page.getByRole('combobox', { name: 'Data segment base' });
  await expect(range).toHaveCSS('background-color', 'rgb(45, 57, 72)');
  await expect(range.locator('option').first()).toHaveCSS('background-color', 'rgb(22, 30, 39)');
  await expect(range.locator('option').first()).toHaveCSS('color', 'rgb(225, 233, 242)');
  await range.selectOption('heap');
  await expect(range).toHaveValue('heap');
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  const register = page.getByLabel('$t0 value', { exact: true });
  await expect(register).toHaveValue('0x0000002a');
  await expect(page.locator('.text-segment tr[data-highlight="pc"]')).toHaveCSS(
    'background-color',
    'rgb(98, 81, 36)'
  );
  await toggle.click();
  await expect(range.locator('option').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(register).toHaveValue('0x0000002a');
  await expect(page.locator('.text-segment tr[data-highlight="pc"]')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 153)'
  );
  await toggle.click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(37, 47, 60)');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.reload();
  await waitForDesktop(page);
  await expect(toggle).toBeEnabled({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await page.reload();
  await waitForDesktop(page);
  await expect(toggle).toBeEnabled({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('machine tables share one frame and paint stripes and every highlight in both themes', async ({
  page
}) => {
  await openDesktop(page);
  const settings = page.locator('.menubar summary').filter({ hasText: /^Settings$/ });
  await settings.click();
  await page
    .locator('.settings-menu')
    .getByRole('checkbox', { name: 'Delayed branching', exact: true })
    .check();
  await settings.click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Source mips1.asm', exact: true })
    .fill(
      '.data\n.word 0\n.text\nmain: lui $t1,0x1001\naddi $t0, $zero, 5\nsw $t0,0($t1)\nj next\nnop\nnext: nop\n'
    );
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  const step = page.getByRole('button', { name: 'Step', exact: true });
  await step.click();
  await step.click();
  await step.click();
  await step.click();
  const memory = page.getByLabel('Memory 0x10010000', { exact: true });
  await expect(memory).toHaveValue('0x00000005');

  const delaySlot = page.locator('.text-segment tbody tr[data-highlight="delay-slot"]');
  const memoryCell = page.locator('.data-segment td[data-highlight="memory"]');
  const register = page.locator('.register-pane tbody tr[data-highlight="register"]');
  const registerRows = page.locator('.register-pane tbody tr');
  await expect(delaySlot).toHaveAttribute('aria-current', 'step');
  await expect(memoryCell.getByRole('textbox')).toHaveAccessibleName('Memory 0x10010000');
  await expect(register.locator('td').first()).toHaveText('$t0');
  const textHeading = page.locator('.text-segment thead th').first();
  const registerHeading = page.locator('.register-pane thead th').first();
  for (const property of ['font-family', 'font-size', 'padding', 'line-height']) {
    expect(
      await textHeading.evaluate(
        (cell, name) => getComputedStyle(cell).getPropertyValue(name),
        property
      )
    ).toBe(
      await registerHeading.evaluate(
        (cell, name) => getComputedStyle(cell).getPropertyValue(name),
        property
      )
    );
  }

  // Monospace numbers right-align for comparison; the cell naming each row is bold.
  const textCells = page.locator('.text-segment tbody tr').first().locator('td');
  const dataCells = page.locator('.data-segment tbody tr').first().locator('td');
  const registerCells = registerRows.first().locator('td');
  const labelCells = page.getByRole('region', { name: 'Labels', exact: true }).locator('tbody td');
  for (const cell of [textCells.nth(1), dataCells.nth(0)]) {
    await expect(cell).toHaveCSS('text-align', 'right');
    await expect(cell).toHaveCSS('font-weight', '700');
  }
  for (const value of [
    textCells.nth(2).getByRole('textbox'),
    memory,
    registerCells.nth(2).getByRole('textbox')
  ])
    await expect(value).toHaveCSS('text-align', 'right');
  await expect(registerCells.nth(1)).toHaveCSS('text-align', 'right');
  await expect(textCells.nth(3)).toHaveCSS('text-align', 'start');
  for (const name of [registerCells.nth(0), labelCells.first()]) {
    await expect(name).toHaveCSS('font-weight', '700');
    await expect(name).toHaveCSS('text-align', 'start');
  }
  await expect(labelCells.nth(1)).toHaveCSS('text-align', 'right');

  const palettes = {
    light: {
      delaySlot: 'rgb(51, 255, 0)',
      memory: 'rgb(153, 204, 255)',
      register: 'rgb(153, 204, 85)',
      stripes: ['rgb(224, 224, 224)', 'rgb(255, 255, 255)']
    },
    dark: {
      delaySlot: 'rgb(37, 91, 70)',
      memory: 'rgb(37, 77, 112)',
      register: 'rgb(56, 84, 45)',
      stripes: ['rgb(37, 49, 64)', 'rgb(22, 30, 39)']
    }
  };
  for (const palette of [palettes.light, palettes.dark]) {
    if (palette === palettes.dark) await page.getByRole('switch', { name: 'Dark theme' }).click();
    await expect(delaySlot).toHaveCSS('background-color', palette.delaySlot);
    await expect(memoryCell).toHaveCSS('background-color', palette.memory);
    await expect(register).toHaveCSS('background-color', palette.register);
    await expect(registerRows.nth(0)).toHaveCSS('background-color', palette.stripes[0]);
    await expect(registerRows.nth(1)).toHaveCSS('background-color', palette.stripes[1]);
  }
  await step.click();
  await page.getByRole('button', { name: 'Backstep', exact: true }).click();
  await expect(delaySlot).toHaveAttribute('aria-current', 'step');
  await step.click();
  await expect(delaySlot).toHaveCount(0);
  await page.getByRole('button', { name: 'Coproc 1', exact: true }).click();
  await expect(page.getByLabel('$f0 float value', { exact: true })).toHaveCSS(
    'text-align',
    'right'
  );
  await expect(page.getByLabel('$f0 double value', { exact: true })).toHaveCSS(
    'text-align',
    'right'
  );
  await expect(registerRows.first().locator('td').first()).toHaveCSS('font-weight', '700');
});

test('saved dark palette is applied before hydration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mars-ts:theme:v1', 'dark'));
  // Hold application modules to observe the initial document without hydration.
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue()
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.loading-screen')).toHaveCSS('background-color', 'rgb(32, 40, 51)');
});

test('invalid preferences and unavailable storage keep appearance usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('mars-ts:theme:v1', 'invalid');
  });
  await openDesktop(page);
  const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
  await expect(toggle.locator('.thumb')).toHaveCSS('transition-duration', '0.3s');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      }
    });
  });
  await toggle.click();
  await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(32, 40, 51)');
  await toggle.click();
  await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(237, 237, 237)');
});

test('slider visibly travels in both directions even with reduced motion enabled', async ({
  page
}) => {
  await openDesktop(page);
  await expect(page.locator('.theme-control')).toContainText('Theme:');
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const destination of [28, 0]) {
      const positions = await page
        .getByRole('switch', { name: 'Dark theme' })
        .evaluate(async (element) => {
          const thumb = element.querySelector<HTMLElement>('.thumb')!;
          const positions: number[] = [];
          const readPosition = () => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
          positions.push(readPosition());
          (element as HTMLButtonElement).click();
          const start = performance.now();
          await new Promise<void>((resolve) => {
            function sample() {
              positions.push(readPosition());
              if (performance.now() - start < 600) requestAnimationFrame(sample);
              else resolve();
            }
            requestAnimationFrame(sample);
          });
          return positions;
        });
      expect(positions[0]).toBe(28 - destination);
      expect(positions.some((position) => position > 1 && position < 27)).toBe(true);
      expect(positions.at(-1)).toBe(destination);
    }
  }
});
