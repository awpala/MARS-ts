import { expect, test } from '@playwright/test';
import { openDesktop, openStoredSources } from '../harness/openDesktop.js';

test('editor copies indentation, overstrikes within a line, and repeats characters and editing commands', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const input = page.getByTestId('source-input');
  await input.fill('\t  nop');
  await input.press('End');
  await input.press('Enter');
  await expect(input).toHaveValue('\t  nop\n\t  ');
  await input.fill('abcd\nlast');
  await input.press('Control+Home');
  await input.press('ArrowRight');
  await input.press('Insert');
  await input.press('Z');
  await expect(input).toHaveValue('aZcd\nlast');
  await input.press('Insert');
  await input.fill('');
  const feedback = page.getByRole('status', { name: 'Editor input mode' });
  await input.press('Control+Enter');
  await expect(feedback).toHaveText('Repeat ×1 (Ctrl+Enter)');
  await input.press('3');
  await expect(feedback).toHaveText('Repeat ×3 (Ctrl+Enter)');
  await expect(input).toHaveValue('');
  await input.press('x');
  await expect(feedback).toBeEmpty();
  await expect(input).toHaveValue('xxx');
  await input.press('Control+Enter');
  await input.press('2');
  await input.press('Backspace');
  await expect(input).toHaveValue('x');
  await expect(feedback).toBeEmpty();
  await input.press('Control+Backslash');
  await input.press('Control+Enter');
  await input.press('1');
  await input.press('2');
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\) · Repeat ×12 (Ctrl+Enter)');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(feedback).toBeEmpty();
  await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\) · Repeat ×12 (Ctrl+Enter)');
  await input.press('Escape');
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\)');
  await input.press('Control+Backslash');
  await expect(feedback).toBeEmpty();
});

test('a release-only Ctrl+Backslash toggles rectangular selection and plain Control leaves the footer alone', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  const feedback = page
    .getByTestId('desktop-footer')
    .getByRole('status', { name: 'Editor input mode' });
  await source.fill('A12Z\nB34Y\nC56X');
  await source.press('Control+Home');
  await source.press('ArrowRight');
  await page.keyboard.down('Control');
  await expect(feedback).toBeEmpty();
  await page.keyboard.up('Control');
  await expect(feedback).toBeEmpty();

  // Chrome on the reported Windows host delivered only the Backslash keyup with Control held.
  const release = { key: '\\', code: 'Backslash', ctrlKey: true };
  await source.dispatchEvent('keyup', release);
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\)');
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown'])
    await source.press('Shift+' + key);
  await expect(page.getByTestId('editor-selected-columns')).toHaveText(['12', '34', '56']);
  await source.dispatchEvent('keyup', release);
  await expect(feedback).toBeEmpty();
  await expect(page.getByTestId('editor-selected-columns')).toHaveCount(0);

  await source.dispatchEvent('keyup', { ...release, ctrlKey: false });
  await source.dispatchEvent('keyup', { ...release, shiftKey: true });
  const newFile = page.getByRole('button', { name: 'New', exact: true });
  await newFile.focus();
  await newFile.dispatchEvent('keyup', release);
  await expect(feedback).toBeEmpty();
});

test('rectangular source selection copies columns, clips short rows, and replaces one row at a time', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const input = page.getByTestId('source-input');
  await input.fill('abcd\nx\n1234');
  await input.press('Control+Home');
  await input.press('ArrowRight');
  await input.press('Control+Backslash');
  await input.press('Shift+ArrowDown');
  await input.press('Shift+ArrowDown');
  await input.press('Shift+ArrowRight');
  await input.press('Shift+ArrowRight');
  await expect(page.getByTestId('editor-selected-columns')).toHaveText(['bc', '', '23']);
  await input.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('bc\n\n23');
  await page.evaluate(() => navigator.clipboard.writeText('AA\nBB\nCC\nmore'));
  await input.press('Control+v');
  await expect(input).toHaveValue('aAAd\nxBB\n1CC4\nmore');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input).toHaveValue('abcd\nx\n1234');
});

test('rectangular selection reports the toggle and cuts only the middle columns in a contrast theme', async ({
  page,
  context
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  const feedback = page.getByRole('status', { name: 'Editor input mode' });
  await source.fill('A12Z\nB34Y\nC56X');
  await source.press('Control+Home');
  await source.press('ArrowRight');
  await page.keyboard.down('Control');
  await page.keyboard.down('Backslash');
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\)');
  await page.keyboard.down('Backslash');
  await page.keyboard.up('Backslash');
  await page.keyboard.up('Control');
  await expect(feedback).toHaveText('Rectangular selection (Ctrl+\\)');
  await page.keyboard.down('Shift');
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown'])
    await page.keyboard.press(key);
  await page.keyboard.up('Shift');
  const columns = page.getByTestId('editor-selected-columns');
  await expect(columns).toHaveText(['12', '34', '56']);
  for (const mark of await columns.all()) await expect(mark).toBeVisible();
  expect(await source.evaluate((el) => getComputedStyle(el, '::selection').backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)'
  );
  await source.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('12\n34\n56');
  await source.press('Control+x');
  await expect(source).toHaveValue('AZ\nBY\nCX');
  await expect(feedback).toBeEmpty();
});

test('the physical backslash and the Edit menu control the same per-source selection mode', async ({
  page
}) => {
  await openDesktop(page);
  const menu = page.getByTestId('menu-edit-trigger');
  const option = page.getByRole('checkbox', { name: 'Rectangular selection', exact: true });
  const feedback = page.getByRole('status', { name: 'Editor input mode' });
  await menu.click();
  await expect(option).toBeDisabled();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  await source.fill('A12Z\nB34Y\nC56X');
  await source.press('Control+Home');
  await source.press('ArrowRight');
  await source.dispatchEvent('keydown', { ctrlKey: true, code: 'Backslash', key: 'Unidentified' });
  await expect(feedback).toContainText('Rectangular selection');
  await menu.click();
  await expect(option).toBeChecked();
  await option.click();
  await expect(feedback).toBeEmpty();
  await menu.click();
  await option.click();
  await expect(source).toBeFocused();
  await expect(feedback).toContainText('Rectangular selection');
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown'])
    await source.press('Shift+' + key);
  await expect(page.getByTestId('editor-selected-columns')).toHaveText(['12', '34', '56']);
  await source.press('Delete');
  await expect(source).toHaveValue('AZ\nBY\nCX');
  await expect(feedback).toBeEmpty();
});

test('rectangular selection uses the displayed columns when a stored source has Windows line endings', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesktop(page);
  await openStoredSources(page, [{ name: 'windows.asm', source: 'A12Z\r\nB34Y\r\nC56X' }]);
  const source = page.getByRole('textbox', { name: 'Source windows.asm', exact: true });
  await source.press('Control+Home');
  await source.press('ArrowRight');
  await source.press('Control+Backslash');
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown'])
    await source.press('Shift+' + key);
  await expect(page.getByTestId('editor-selected-columns')).toHaveText(['12', '34', '56']);
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('12\n34\n56');
  await page.evaluate(() => navigator.clipboard.writeText('aa\r\nbb\r\ncc'));
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(source).toHaveValue('AaaZ\nBbbY\nCccX');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(source).toHaveValue('A12Z\nB34Y\nC56X');
});

test('Undo and both Redo shortcuts restore the middle-line selection and caret across reload', async ({
  page
}) => {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const source = page.getByTestId('source-input');
  const selection = () =>
    source.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
      el.selectionDirection
    ]);
  const tail = '\ntail'.repeat(150);
  await source.fill('head\naaaaaa' + tail);
  await source.press('Control+Home');
  await source.press('ArrowDown');
  for (let i = 0; i < 5; i++) await source.press('ArrowRight');
  await source.press('Shift+ArrowLeft');
  await source.press('Shift+ArrowLeft');
  expect(await selection()).toEqual([8, 10, 'backward']);
  await source.press('Z');
  await expect(source).toHaveValue('head\naaaZa' + tail);
  await source.press('Control+End');
  for (const shortcut of ['Control+y', 'Control+Shift+z']) {
    await source.press('Control+z');
    await expect(source).toHaveValue('head\naaaaaa' + tail);
    expect(await selection()).toEqual([8, 10, 'backward']);
    expect(await source.evaluate((el) => el.scrollTop)).toBe(0);
    if (shortcut === 'Control+y') {
      await page.reload();
      await expect(source).toHaveValue('head\naaaaaa' + tail);
    }
    await source.press('Control+End');
    await source.press(shortcut);
    await expect(source).toHaveValue('head\naaaZa' + tail);
    expect((await selection()).slice(0, 2)).toEqual([9, 9]);
    expect(await source.evaluate((el) => el.scrollTop)).toBe(0);
  }
  await source.press('!');
  await expect(source).toHaveValue('head\naaaZ!a' + tail);
});

test('Edit clipboard shortcuts use the source selection from the toolbar and respect focused dialog fields', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesktop(page);
  const newFile = page.getByRole('button', { name: 'New', exact: true });
  await newFile.click();
  const source = page.getByTestId('source-input');
  await page.getByTestId('menu-edit-trigger').click();
  for (const [command, key] of [
    ['cut', 'X'],
    ['copy', 'C'],
    ['paste', 'V']
  ]) {
    await expect(page.getByTestId('menu-item-' + command).getByTestId('shortcut-key')).toHaveText([
      'Ctrl',
      key
    ]);
  }
  await page.getByTestId('menu-edit-trigger').click();
  await source.fill('alpha\nbeta\ngamma');
  await source.press('Control+Home');
  await source.press('ArrowDown');
  await source.press('Shift+End');
  await newFile.focus();
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('beta');
  await newFile.focus();
  await page.keyboard.press('Control+x');
  await expect(source).toHaveValue('alpha\n\ngamma');
  await newFile.focus();
  await page.keyboard.press('Control+v');
  await expect(source).toHaveValue('alpha\nbeta\ngamma');
  await source.press('Control+z');
  await expect(source).toHaveValue('alpha\n\ngamma');
  expect(await source.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(6);

  await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
  const filename = page.getByRole('dialog').getByLabel('File name');
  await filename.fill('field');
  await filename.press('Control+a');
  await filename.press('Control+x');
  await expect(filename).toHaveValue('');
  await filename.press('Control+v');
  await expect(filename).toHaveValue('field');
  await expect(source).toHaveValue('alpha\n\ngamma');
});
