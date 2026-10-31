import { expect, test } from '@playwright/test';
import { openDesktop } from '../harness/openDesktop.js';

for (const theme of ['light', 'dark']) {
  test(`Open shares bulk selection and enabled hover feedback in ${theme} mode`, async ({
    page
  }) => {
    await openDesktop(page);
    if (theme === 'dark')
      await page.getByRole('switch', { name: 'Dark theme', exact: true }).click();
    const open = page.getByRole('button', { name: 'Open ...', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Open', exact: true });
    const all = dialog.getByRole('button', { name: 'Select all', exact: true });
    const none = dialog.getByRole('button', { name: 'Select none', exact: true });
    const submit = dialog.getByRole('button', { name: 'Open', exact: true });
    const remove = dialog.getByRole('button', { name: 'Delete', exact: true });
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    await open.click();
    for (const button of [all, none, submit, remove]) await expect(button).toBeDisabled();
    await cancel.click();
    await page.evaluate(() =>
      localStorage.setItem(
        'mars-ts:sources:v1',
        JSON.stringify([
          { name: 'beta.asm', source: '.text\nnop\n' },
          { name: 'alpha.asm', source: '.text\nnop\n' }
        ])
      )
    );
    await open.click();
    await expect(all).toBeEnabled();
    await expect(none).toBeDisabled();
    const choices = dialog.getByRole('checkbox');
    await choices.first().check();
    for (const button of [all, none, submit, remove, cancel]) {
      await page.mouse.move(0, 0);
      const background = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
      await button.hover();
      await expect(button).not.toHaveCSS('background-color', background);
      await expect(button).toHaveCSS(
        'background-color',
        theme === 'dark' ? 'rgb(53, 79, 105)' : 'rgb(219, 232, 242)'
      );
    }
    const left = (await all.boundingBox())!;
    const right = (await submit.boundingBox())!;
    const end = (await cancel.boundingBox())!;
    const list = (await dialog.getByRole('group').boundingBox())!;
    expect(Math.abs(left.x - list.x)).toBeLessThan(2);
    expect(Math.abs(end.x + end.width - (list.x + list.width))).toBeLessThan(2);
    expect(Math.abs(left.y - right.y)).toBeLessThan(2);
    expect(right.x).toBeGreaterThan(
      (await none.boundingBox())!.x + (await none.boundingBox())!.width
    );
    await all.click();
    for (const choice of await choices.all()) await expect(choice).toBeChecked();
    await expect(all).toBeDisabled();
    await page.mouse.move(0, 0);
    const disabledBackground = await all.evaluate((node) => getComputedStyle(node).backgroundColor);
    await all.hover();
    await expect(all).toHaveCSS('background-color', disabledBackground);
    await none.click();
    for (const choice of await choices.all()) await expect(choice).not.toBeChecked();
    await expect(none).toBeDisabled();
    await expect(submit).toBeDisabled();
    await expect(remove).toBeDisabled();
    await all.click();
    await expect(dialog).toBeVisible();
    await submit.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close alpha.asm', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close beta.asm', exact: true })).toBeVisible();
  });
}
