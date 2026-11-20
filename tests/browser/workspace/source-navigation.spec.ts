import { expect, test } from '@playwright/test';
import { instructionRow } from '../harness/locators.js';
import { openDesktop, openStoredSources } from '../harness/openDesktop.js';

test('source navigation follows the mounted editor line height across view replacements', async ({
  page
}) => {
  await openDesktop(page);
  await page.addStyleTag({
    content: '[data-testid="source-input"] { line-height: 32px !important; }'
  });
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  const program = '.text\n' + 'nop\n'.repeat(60);
  await source.fill(program);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  for (const line of [32, 2, 52]) {
    const address = `0x${(0x00400000 + (line - 2) * 4).toString(16).padStart(8, '0')}`;
    await instructionRow(page, address).getByTestId('text-source-link').click();
    await expect(source).toBeFocused();
    const maxScroll = await source.evaluate((input) => input.scrollHeight - input.clientHeight);
    await expect
      .poll(() =>
        source.evaluate((input: HTMLTextAreaElement) => ({
          selection: [input.selectionStart, input.selectionEnd],
          top: input.scrollTop
        }))
      )
      .toEqual({
        selection: [6 + (line - 2) * 4, 6 + (line - 2) * 4],
        top: Math.min(maxScroll, Math.max(0, (line - 3) * 32))
      });
    await page.getByRole('button', { name: 'Execute', exact: true }).click();
  }
});

test('Text Segment source links resolve the included file for both words of a pseudo-instruction', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(page, [
    { name: 'part.asm', source: '# part\nli $t2,0x12345678\n' },
    { name: 'main.asm', source: '.text\n.include "part.asm"\n' }
  ]);
  await page.getByRole('button', { name: 'main.asm', exact: true }).click();
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  for (const address of ['0x00400000', '0x00400004']) {
    await instructionRow(page, address).getByTestId('text-source-link').click();
    const source = page.getByRole('textbox', { name: 'Source part.asm', exact: true });
    await expect(source).toBeFocused();
    expect(await source.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(7);
    await page.getByRole('button', { name: 'Execute', exact: true }).click();
  }
});

test('manual and automatic assembly select the first diagnostic and clicking later messages navigates a closed source', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByLabel('Assemble file on open', { exact: true }).check();
  await page.getByTestId('menu-settings-trigger').click();
  await openStoredSources(
    page,
    [
      { name: 'main.asm', source: '.text\nbad_main\n.include "part.asm"\n' },
      { name: 'part.asm', source: '# included\nbad_part\n' }
    ],
    ['main.asm']
  );
  const messages = page.getByRole('textbox', { name: 'Mars Messages', exact: true });
  const main = page.getByRole('textbox', { name: 'Source main.asm', exact: true });
  const selected = (el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd);
  await expect.poll(() => messages.evaluate(selected)).toContain('Error in main.asm line 2');
  expect(await main.evaluate(selected)).toBe('');
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await expect.poll(() => main.evaluate(selected)).toBe('bad_main');
  const position = await messages.evaluate((el: HTMLTextAreaElement) => {
    const start = el.value.lastIndexOf('Error in /part.asm');
    if (start < 0) throw new Error('Missing included-source diagnostic');
    const line = el.value.slice(0, start).split('\n').length - 1;
    const style = getComputedStyle(el);
    const height = parseFloat(style.lineHeight);
    el.scrollTop = line * height;
    return { x: 20, y: parseFloat(style.paddingTop) + (line + 0.5) * height - el.scrollTop };
  });
  await messages.click({ position });
  const part = page.getByRole('textbox', { name: 'Source part.asm', exact: true });
  await expect(part).toBeFocused();
  expect(await part.evaluate(selected)).toBe('bad_part');
  expect(await messages.evaluate(selected)).toContain('Error in /part.asm line 2');
});

test('warnings promoted to errors select the first eligible source line in assembler order', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByLabel('Assembler warnings are considered errors', { exact: true }).check();
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  const messages = page.getByRole('textbox', { name: 'Mars Messages', exact: true });
  const selected = (el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd);
  for (const [program, line, prefix] of [
    ['.text\nbad_op\n.set noat', 'bad_op', 'Error in'],
    ['.text\n.set noat\nbad_op', '.set noat', 'Warning in']
  ]) {
    await source.fill(program);
    await page.getByRole('button', { name: 'Assemble', exact: true }).click();
    await expect.poll(() => source.evaluate(selected)).toBe(line);
    expect(await messages.evaluate(selected)).toContain(prefix);
  }
});
