import { expect, test } from '@playwright/test';
import { instructionRow } from '../harness/locators.js';
import { openDesktop } from '../harness/openDesktop.js';

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
