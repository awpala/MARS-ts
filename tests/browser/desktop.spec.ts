import { openDesktop } from './openDesktop.js';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('modal backdrop closes Help and cancels dirty-file closure without losing source', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	const help = page.getByRole('dialog', { name: 'MARS Help', exact: true });
	await expect(help).toBeVisible();
	await help.getByRole('heading', { name: 'MARS Help', exact: true }).click();
	await expect(help).toBeVisible();
	await page.mouse.click(10, 10);
	await expect(help).toHaveCount(0);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	await source.fill('preserve this source');
	await page.getByRole('button', { name: 'Close mips1.asm', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Save changes?', exact: true })).toBeVisible();
	await page.mouse.click(10, 10);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(source).toHaveValue('preserve this source');
});

test('working display settings and run speed survive reload', async ({ page }) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill('.text\nmain:\n');
	const settings = page.locator('.menubar summary').filter({ hasText: /^Settings$/ });
	await settings.click();
	await expect(page.getByRole('button', { name: 'Editor ...', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Highlighting ...', exact: true })).toHaveCount(0);
	await expect(
		page.getByRole('checkbox', { name: 'Assemble all open files in editor', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Assemble all files in directory', exact: true })
	).toHaveCount(0);
	await page.getByLabel('Show line numbers', { exact: true }).uncheck();
	await page.getByLabel('Show Labels Window', { exact: true }).check();
	await page.getByLabel('Addresses displayed in hexadecimal', { exact: true }).uncheck();
	await page.getByLabel('Values displayed in hexadecimal', { exact: true }).uncheck();
	await page.getByRole('button', { name: 'Execute', exact: true }).click();
	const slider = page.getByRole('slider');
	await slider.fill('20');
	await page.reload();
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	await settings.click();
	await expect(page.getByLabel('Show line numbers', { exact: true })).not.toBeChecked();
	await expect(page.getByLabel('Show Labels Window', { exact: true })).toBeChecked();
	await expect(
		page.getByLabel('Addresses displayed in hexadecimal', { exact: true })
	).not.toBeChecked();
	await expect(
		page.getByLabel('Values displayed in hexadecimal', { exact: true })
	).not.toBeChecked();
	await expect(slider).toHaveValue('20');
});

test('pane sizes persist after reload and the editor divider adjusts height', async ({ page }) => {
	await openDesktop(page);
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	const vertical = page.getByRole('separator', { name: 'Register panel width' });
	const horizontal = page.getByRole('separator', { name: 'Editor area height' });
	const before = Number(await horizontal.getAttribute('aria-valuenow'));
	const box = (await horizontal.boundingBox())!;
	await page.mouse.move(box.x + 100, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y - 60);
	await page.mouse.up();
	expect(Number(await horizontal.getAttribute('aria-valuenow'))).toBeLessThan(before - 50);
	await horizontal.press('ArrowDown');
	await vertical.press('ArrowLeft');
	const width = await vertical.getAttribute('aria-valuenow');
	const height = await horizontal.getAttribute('aria-valuenow');
	await page.reload();
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	await expect(vertical).toHaveAttribute('aria-valuenow', width!);
	await expect(horizontal).toHaveAttribute('aria-valuenow', height!);
});

test('Coproc 1 condition flags sit below their caption in control-number pairs', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'Coproc 1', exact: true }).click();
	const caption = (await page.getByText('Condition flags', { exact: true }).boundingBox())!;
	for (let index = 0; index < 8; index++) {
		const control = page.getByRole('checkbox', { name: `Condition flag ${index}`, exact: true });
		const checkbox = (await control.boundingBox())!;
		const number = (await control.locator('..').locator('span').boundingBox())!;
		expect(checkbox.y).toBeGreaterThanOrEqual(caption.y + caption.height);
		expect(number.x).toBeGreaterThan(checkbox.x);
		expect(Math.abs(number.y - checkbox.y)).toBeLessThan(6);
	}
});

test('launches the desktop directly, renders original assets, and edits real session registers', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await openDesktop(page);
	await expect(page.getByRole('navigation', { name: 'Application menus' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Assemble', exact: true })).toBeDisabled();
	await expect(page.getByLabel('$gp value', { exact: true })).toHaveValue('0x10008000');
	await expect(page.getByLabel('$sp value', { exact: true })).toHaveValue('0x7fffeffc');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400000');
	await expect(page.getByLabel('$zero value', { exact: true })).toHaveAttribute('readonly', '');
	await page.getByLabel('$t0 value', { exact: true }).fill('-1');
	await page.getByLabel('$t0 value', { exact: true }).press('Enter');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0xffffffff');
	await page.getByRole('button', { name: 'Execute', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Text Segment' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Data Segment' })).toBeVisible();
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.ico$/);
	for (const image of await page.locator('.toolbar img').all()) {
		expect(
			await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)
		).toBeGreaterThan(0);
	}
	await page.screenshot({ path: '__build/desktop.png', fullPage: true });
	expect(errors).toEqual([]);
	await page.reload();
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000000');
});

test('new buffers save exact content through a same-tab modal and a browser download', async ({
	page,
	context
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	const program = '.text\nmain:\n\tli $v0, 10\n\tsyscall\n';
	await source.fill(program);
	await expect(page).toHaveTitle(/^\* /);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Save As', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByLabel('File name')).toBeFocused();
	await dialog.getByLabel('File name').fill('exit.asm');
	const downloadEvent = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	const download = await downloadEvent;
	expect(download.suggestedFilename()).toBe('exit.asm');
	expect(await readFile((await download.path())!, 'utf8')).toBe(program);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page).toHaveTitle('exit.asm - MARS');
	expect(context.pages()).toHaveLength(1);
});

test('opens multiple files, preserves dirty content on cancel, finds/replaces, undoes, and discards', async ({
	page
}) => {
	await openDesktop(page);
	await expect(page.getByLabel('Open assembly files')).toBeEnabled();
	await page.getByLabel('Open assembly files').setInputFiles([
		{ name: 'one.asm', mimeType: 'text/plain', buffer: Buffer.from('one\none\n') },
		{ name: 'two.asm', mimeType: 'text/plain', buffer: Buffer.from('two\n') }
	]);
	await expect(page.getByRole('textbox', { name: 'Source two.asm' })).toHaveValue('two\n');
	await page.getByRole('button', { name: 'one.asm', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source one.asm', exact: true });
	await source.fill('one\none\nchanged\n');
	await page.getByRole('button', { name: 'Close one.asm', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Save changes?' })
		.getByRole('button', { name: 'Cancel' })
		.click();
	await expect(source).toHaveValue('one\none\nchanged\n');
	await page.getByRole('button', { name: 'Find/Replace', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Find / Replace' });
	await dialog.getByLabel('Find', { exact: true }).fill('one');
	await dialog.getByLabel('Replace with').fill('first');
	await dialog.getByRole('button', { name: 'Replace All' }).click();
	await expect(dialog.getByRole('status')).toHaveText('2 occurrence(s) replaced.');
	await dialog.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(source).toHaveValue('first\nfirst\nchanged\n');
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(source).toHaveValue('one\none\nchanged\n');
	await page.getByRole('button', { name: 'Close one.asm', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Save changes?' })
		.getByRole('button', { name: 'Discard' })
		.click();
	await expect(page.getByRole('textbox', { name: 'Source two.asm' })).toHaveValue('two\n');
	await expect(page.getByRole('button', { name: 'Close one.asm', exact: true })).toHaveCount(0);
});

test('menus dismiss outside and retain usable actions inside', async ({ page }) => {
	await openDesktop(page);
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	const file = page
		.locator('.menubar details')
		.filter({ has: page.locator('summary').filter({ hasText: /^File$/ }) });
	await file.locator('summary').click();
	await expect(file).toHaveAttribute('open', '');
	await page.getByRole('button', { name: 'Coproc 0', exact: true }).click();
	await expect(file).not.toHaveAttribute('open', '');
	await file.locator('summary').click();
	await file.getByRole('button', { name: /^New/ }).click();
	await expect(page.getByRole('textbox', { name: 'Source mips1.asm', exact: true })).toBeVisible();
});

test('register width adjusts horizontally without changing the panel height', async ({ page }) => {
	await openDesktop(page);
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	const divider = page.getByRole('separator', { name: 'Register panel width' });
	const panel = page.locator('.register-pane');
	const before = (await panel.boundingBox())!;
	const handle = (await divider.boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
	await page.mouse.down();
	await page.mouse.move(handle.x - 80, handle.y + 100);
	await page.mouse.up();
	const after = (await panel.boundingBox())!;
	expect(after.width).toBeGreaterThan(before.width + 70);
	expect(after.height).toBe(before.height);
	const width = Number(await divider.getAttribute('aria-valuenow'));
	await divider.press('ArrowRight');
	await expect(divider).toHaveAttribute('aria-valuenow', String(width - 10));
	await divider.press('Home');
	await expect(divider).toHaveAttribute('aria-valuenow', '260');
});

test('source highlighting follows edits while retaining exact textarea content', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	const program = '.text\nmain:\n\tadd $t0, $t1, $t2 # sum\n.asciiz "hello"\n';
	await source.fill(program);
	const layer = page.locator('.syntax-layer');
	await expect(layer).toHaveAttribute('aria-hidden', 'true');
	await expect(layer.locator('[data-token="7"]').first()).toHaveText('.text');
	await expect(layer.locator('[data-token="6"]')).toHaveText('add');
	await expect(layer.locator('[data-token="8"]')).toHaveCount(3);
	await expect(layer.locator('[data-token="1"]')).toHaveText('# sum');
	await expect(layer.locator('[data-token="3"]')).toHaveText('"hello"');
	await expect(source).toHaveValue(program);
	await source.fill('.asciiz "unterminated');
	await expect(layer.locator('[data-token="10"]')).toHaveText('"unterminated');
	await expect(layer.locator('[data-token="6"]')).toHaveCount(0);
});

test('Tab inserts a literal tab, replaces the selection, preserves focus, and undoes', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	await source.fill('abc');
	await source.evaluate((input) => (input as HTMLTextAreaElement).setSelectionRange(1, 2));
	await source.press('Tab');
	await expect(source).toHaveValue('a\tc');
	await expect(source).toBeFocused();
	expect(await source.evaluate((input) => (input as HTMLTextAreaElement).selectionStart)).toBe(2);
	await source.press('Control+z');
	await expect(source).toHaveValue('abc');
});

test('Save All prompts for each new file and cancel preserves the remaining buffer', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill('first');
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: 'Source mips2.asm', exact: true }).fill('second');
	await page
		.locator('summary')
		.filter({ hasText: /^File$/ })
		.click();
	await page.getByRole('button', { name: 'Save All', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Save As', exact: true });
	await expect(dialog.getByLabel('File name')).toHaveValue('mips1.asm');
	await expect(dialog.getByLabel('File name')).toBeFocused();
	const downloadEvent = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	const download = await downloadEvent;
	expect(await readFile((await download.path())!, 'utf8')).toBe('first');
	await expect(dialog.getByLabel('File name')).toHaveValue('mips2.asm');
	await expect(dialog.getByLabel('File name')).toBeFocused();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('button', { name: 'mips1.asm', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: '* mips2.asm', exact: true })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Source mips2.asm', exact: true })).toHaveValue(
		'second'
	);
});
