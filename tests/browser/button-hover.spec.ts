import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDesktop, openStoredSources } from './openDesktop.js';

async function checkHover(page: Page, button: Locator, theme: string, highlight = true) {
  await page.mouse.move(0, 0);
  const before = await button.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    border: getComputedStyle(node).borderTopColor
  }));
  const enabled = await button.isEnabled();
  await button.hover();
  if (enabled && highlight) {
    await expect(button).toHaveCSS(
      'background-color',
      theme === 'dark' ? 'rgb(53, 79, 105)' : 'rgb(219, 232, 242)'
    );
    await expect(button).toHaveCSS(
      'border-top-color',
      theme === 'dark' ? 'rgb(128, 175, 213)' : 'rgb(132, 158, 181)'
    );
  } else {
    await expect(button).toHaveCSS('background-color', before.background);
    await expect(button).toHaveCSS('border-top-color', before.border);
  }
}

async function checkDialog(page: Page, dialog: Locator, theme: string) {
  await expect(dialog).toBeVisible();
  for (const button of await dialog.getByRole('button').all())
    await checkHover(page, button, theme);
}

for (const theme of ['light', 'dark']) {
  test(`shared button hover covers dialogs and Delete sources in ${theme} mode`, async ({
    page
  }) => {
    test.setTimeout(120_000);
    await openDesktop(page);
    if (theme === 'dark')
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    const action = (name: string) => page.getByRole('button', { name, exact: true });
    const dialog = (name: string) => page.getByRole('dialog', { name, exact: true });
    await openStoredSources(page, [{ name: 'saved.asm', source: '.text\nnop\n' }]);
    await action('Open ...').click();
    await dialog('Open').getByRole('button', { name: 'Select all', exact: true }).click();
    await checkDialog(page, dialog('Open'), theme);
    await dialog('Open').getByRole('button', { name: 'Delete', exact: true }).click();
    await checkDialog(page, dialog('Delete sources?'), theme);
    await dialog('Delete sources?').getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog('Open').getByRole('button', { name: 'Cancel', exact: true }).click();

    await action('Find/Replace').click();
    await checkDialog(page, dialog('Find / Replace'), theme);
    await dialog('Find / Replace').getByRole('textbox', { name: 'Find', exact: true }).fill('nop');
    await checkDialog(page, dialog('Find / Replace'), theme);
    await dialog('Find / Replace').getByRole('button', { name: 'Close', exact: true }).click();

    await action('New').click();
    await page.getByRole('textbox', { name: /^Source / }).fill('.text\nnop\n');
    await action('Save').click();
    await checkDialog(page, dialog('Save As'), theme);
    await dialog('Save As').getByRole('button', { name: 'Cancel', exact: true }).click();
    await action('Help').click();
    await checkDialog(page, dialog('MARS Help'), theme);
    await dialog('MARS Help').getByRole('button', { name: 'Close', exact: true }).click();

    await page
      .locator('.menubar summary')
      .filter({ hasText: /^Settings$/ })
      .click();
    await page
      .locator('.settings-menu')
      .getByRole('button', { name: 'Memory Configuration ...', exact: true })
      .click();
    await checkDialog(page, dialog('MIPS Memory Configuration'), theme);
    await dialog('MIPS Memory Configuration')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
  });

  test(`shared button hover preserves selected tabs and disabled controls in ${theme} mode`, async ({
    page
  }) => {
    test.setTimeout(120_000);
    await openDesktop(page);
    if (theme === 'dark')
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    const action = (name: string) => page.getByRole('button', { name, exact: true });
    await checkHover(page, action('New'), theme);
    await checkHover(page, action('Step'), theme);
    await checkHover(page, action('Edit'), theme, false);
    await checkHover(page, action('Execute'), theme);
    await action('Execute').click();
    await checkHover(page, action('Execute'), theme, false);
    await checkHover(page, action('Edit'), theme);
    await checkHover(page, action('Increase run speed'), theme);
    await checkHover(page, action('Decrease run speed'), theme);
    await checkHover(page, action('Registers'), theme, false);
    await checkHover(page, action('Coproc 1'), theme);
    await action('Coproc 1').click();
    await checkHover(page, action('Coproc 1'), theme, false);
    await checkHover(page, action('Select all'), theme);
    await checkHover(page, action('Select none'), theme);
    await checkHover(page, action('Clear'), theme);
    await checkHover(page, action('Clear All'), theme);

    await openStoredSources(page, [
      { name: 'alpha.asm', source: '.text\nnop\n' },
      { name: 'beta.asm', source: '.text\nli $v0,5\nsyscall\n' }
    ]);
    await action('Edit').click();
    const sources = page.locator('.source-name');
    await checkHover(page, sources.filter({ hasText: 'alpha.asm' }), theme);
    await checkHover(page, sources.filter({ hasText: 'beta.asm' }), theme, false);
    await checkHover(page, action('Close beta.asm'), theme);
    await action('Assemble').click();
    await action('Go').click();
    await expect(page.getByRole('textbox', { name: 'Run input', exact: true })).toBeVisible();
    await checkHover(
      page,
      page.locator('.console-input').getByRole('button', { name: 'Submit', exact: true }),
      theme
    );
    await checkHover(
      page,
      page.locator('.console-input').getByRole('button', { name: 'Stop', exact: true }),
      theme
    );
    await page.locator('.console-input').getByRole('button', { name: 'Stop', exact: true }).click();
  });
}
