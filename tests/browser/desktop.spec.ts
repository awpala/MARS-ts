import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('Alt and Option N create editor buffers from source and register focus', async ({ page }) => {
	await openDesktop(page);
	const pages = page.context().pages().length;
	await page.getByLabel('$t0 value', { exact: true }).press('Alt+n');
	const first = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	await expect(first).toBeFocused();
	await first.fill('# preserve this buffer');
	await first.press('n');
	await expect(first).toHaveValue('# preserve this buffern');
	await first.press('Backspace');
	await first.press('Alt+n');
	await expect(page.getByRole('textbox', { name: 'Source mips2.asm', exact: true })).toBeFocused();
	await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
	await expect(first).toHaveValue('# preserve this buffer');
	// macOS Option+N starts an accent unless its Dead-key event is canceled.
	expect(
		await first.evaluate((element) =>
			element.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Dead',
					code: 'KeyN',
					altKey: true,
					bubbles: true,
					cancelable: true
				})
			)
		)
	).toBe(false);
	await expect(page.getByRole('textbox', { name: 'Source mips3.asm', exact: true })).toBeFocused();
	// A held shortcut is canceled but must not create a stream of new buffers.
	expect(
		await page.evaluate(() =>
			document.activeElement!.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'n',
					code: 'KeyN',
					altKey: true,
					repeat: true,
					bubbles: true,
					cancelable: true
				})
			)
		)
	).toBe(false);
	await expect(page.getByRole('textbox', { name: 'Source mips3.asm', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.keyboard.press('Alt+n');
	await expect(page.getByRole('dialog', { name: 'MARS Help', exact: true })).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Source mips3.asm', exact: true })).toBeVisible();
	expect(page.context().pages()).toHaveLength(pages);
});

test('About MARS opens the bundled unchanged license in a new tab', async ({ page }) => {
	await openDesktop(page);
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Help$/ })
		.click();
	await page.getByRole('button', { name: 'About MARS', exact: true }).click();
	const about = page.getByRole('dialog', { name: 'About MARS', exact: true });
	const popup = page.waitForEvent('popup');
	await about.getByRole('link', { name: /Read the MIT license/ }).click();
	const license = await popup;
	await license.waitForLoadState();
	await expect(license).toHaveURL(/\/MARSlicense\.txt$/);
	const response = await license.request.get(license.url());
	expect(await response.body()).toEqual(await readFile('MARSlicense.txt'));
	await expect(about).toBeVisible();
	await license.close();
});

test('source hover shows instruction syntax and documentation without interfering with editing', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	const program = '# li comment\n.asciiz "la"\nli $t0, 42\n\tla $t1, label\nadd $t0, $t1, $t2\n';
	await source.fill(program);
	const layer = page.locator('.syntax-layer');
	const tooltip = page.getByRole('tooltip');
	const hoverToken = async (text: string) => {
		await page.mouse.move(5, 5);
		const box = await layer
			.locator('span')
			.filter({ hasText: new RegExp(`^${text}$`) })
			.boundingBox();
		expect(box).not.toBeNull();
		await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
	};
	await hoverToken('li');
	await expect(tooltip).toContainText('Load Immediate');
	await expect(tooltip).toContainText('li $t1,100000');
	await source.press('Escape');
	await expect(tooltip).toBeHidden();
	await hoverToken('la');
	await expect(tooltip).toContainText('Load Address');
	await expect(tooltip).toContainText("label's address");
	await hoverToken('add');
	await expect(tooltip).toContainText('Addition');
	await hoverToken('# li comment');
	await expect(tooltip).toBeHidden();
	await hoverToken('"la"');
	await expect(tooltip).toBeHidden();
	await expect(source).toHaveValue(program);
	// Tabs and both scroll axes must use painted token bounds, not guessed character widths.
	await source.fill('\n'.repeat(60) + '\t'.repeat(20) + 'li $t0, 7\n');
	await source.evaluate((node) => {
		const input = node as HTMLTextAreaElement;
		input.scrollTop = input.scrollHeight;
		input.scrollLeft = input.scrollWidth;
	});
	await expect.poll(() => source.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	await expect.poll(() => source.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
	await hoverToken('li');
	await expect(tooltip).toContainText('Load Immediate');
	await source.press('Control+End');
	await expect(tooltip).toBeHidden();
	await source.press('x');
	await expect(source).toHaveValue('\n'.repeat(60) + '\t'.repeat(20) + 'li $t0, 7\nx');
});

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
	).toHaveCount(0);
	await expect(page.locator('.settings-menu').getByRole('separator')).toHaveCount(3);
	for (const label of [
		'Values displayed in hexadecimal',
		'Initialize Program Counter to global main if defined',
		'Self-modifying code'
	]) {
		const item = page.locator('.settings-menu label').filter({ hasText: label });
		expect(await item.evaluate((element) => element.nextElementSibling?.tagName)).toBe('HR');
	}
	await expect(
		page.getByRole('button', { name: 'Assemble all files in directory', exact: true })
	).toHaveCount(0);
	const menu = page.locator('.settings-menu');
	const toggles = page.getByRole('group', { name: 'Display settings', exact: true });
	const sharedLabels = [
		'Show Labels Window',
		'Popup dialog for input syscalls',
		'Addresses displayed in hexadecimal',
		'Values displayed in hexadecimal'
	];
	expect(
		(await menu.locator('label').allTextContents()).slice(0, 4).map((label) => label.trim())
	).toEqual([sharedLabels[0], `${sharedLabels[1]} (5,6,7,8,12)`, sharedLabels[2], sharedLabels[3]]);
	for (const label of sharedLabels) {
		const checkbox = menu.getByRole('checkbox', { name: label });
		const button = toggles.getByRole('button', { name: label, exact: true });
		const checked = await checkbox.isChecked();
		await checkbox.click();
		await expect(button).toHaveAttribute('aria-pressed', String(!checked));
		await checkbox.click();
		await expect(button).toHaveAttribute('aria-pressed', String(checked));
	}
	await settings.click();
	await expect(toggles.getByRole('button')).toHaveCount(5);
	const editing = page.locator('.toolbar .toolgroup').filter({
		has: page.getByRole('button', { name: 'Undo', exact: true })
	});
	const lines = editing.getByRole('button', { name: 'Show line numbers', exact: true });
	await expect(editing.getByRole('button').last()).toHaveAccessibleName('Show line numbers');
	await lines.press('Shift+Tab');
	await page.keyboard.press('Tab');
	await expect(lines).toHaveAccessibleDescription('Show line numbers');
	await lines.click();
	for (const label of [
		'Show Labels Window',
		'Addresses displayed in hexadecimal',
		'Values displayed in hexadecimal',
		'Popup dialog for input syscalls'
	]) {
		const button = toggles.getByRole('button', { name: label, exact: true });
		await button.press('Shift+Tab');
		await page.keyboard.press('Tab');
		await expect(button).toHaveAccessibleDescription(label);
		await button.click();
	}
	await settings.click();
	for (const label of sharedLabels) {
		const button = toggles.getByRole('button', { name: label, exact: true });
		await expect(menu.getByRole('checkbox', { name: label })).toBeChecked({
			checked: (await button.getAttribute('aria-pressed')) === 'true'
		});
	}
	await settings.click();
	const groupBox = (await toggles.boundingBox())!;
	const helpBox = (await page.getByRole('button', { name: 'Help', exact: true }).boundingBox())!;
	expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(helpBox.x);
	await expect(page.locator('.line-numbers')).toHaveCount(0);
	await page.getByRole('button', { name: 'Execute', exact: true }).click();
	const slider = page.getByRole('slider');
	await expect(page.locator('.speed')).toHaveText('Run speed unlimited');
	await slider.fill('20');
	await expect(page.locator('.speed')).toHaveText('Run speed 15 inst/sec');
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled({
		timeout: 30000
	});
	await expect(lines).toHaveAttribute('aria-pressed', 'false');
	await expect(
		toggles.getByRole('button', { name: 'Show Labels Window', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await expect(
		toggles.getByRole('button', { name: 'Addresses displayed in hexadecimal', exact: true })
	).toHaveAttribute('aria-pressed', 'false');
	await expect(
		toggles.getByRole('button', { name: 'Values displayed in hexadecimal', exact: true })
	).toHaveAttribute('aria-pressed', 'false');
	await expect(
		toggles.getByRole('button', { name: 'Popup dialog for input syscalls', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await settings.click();
	for (const label of sharedLabels) {
		const button = toggles.getByRole('button', { name: label, exact: true });
		await expect(menu.getByRole('checkbox', { name: label })).toBeChecked({
			checked: (await button.getAttribute('aria-pressed')) === 'true'
		});
	}
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
	await waitForDesktop(page);
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
	await waitForDesktop(page);
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000000');
});

test('new buffers save exact content to the local library through a same-tab modal', async ({
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
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'exit.asm', source: program });
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page).toHaveTitle('exit.asm - MARS');
	expect(context.pages()).toHaveLength(1);
});

test('opens multiple files, preserves dirty content on cancel, finds/replaces, undoes, and discards', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [
		{ name: 'one.asm', source: 'one\none\n' },
		{ name: 'two.asm', source: 'two\n' }
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
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'mips1.asm', source: 'first' });
	await expect(dialog.getByLabel('File name')).toHaveValue('mips2.asm');
	await expect(dialog.getByLabel('File name')).toBeFocused();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('button', { name: 'mips1.asm', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: '* mips2.asm', exact: true })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Source mips2.asm', exact: true })).toHaveValue(
		'second'
	);
});

test('working source text, dirty tabs, and selected buffer survive an immediate reload', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'saved.asm', source: '.text\nnop\n' }]);
	const changed = '.text\nli $t0, 123\n# unsaved Unicode: λ\n';
	await page.getByRole('textbox', { name: 'Source saved.asm', exact: true }).fill(changed);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const draft = '.data\nmessage: .asciiz "in progress"\n.text\n\tli $v0, 4\n';
	await page.getByRole('textbox', { name: /^Source mips\d+\.asm$/ }).fill(draft);
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled();
	await expect(page.getByRole('textbox', { name: /^Source mips\d+\.asm$/ })).toHaveValue(draft);
	await expect(page).toHaveTitle(/^\* mips/);
	await page.getByRole('button', { name: '* saved.asm', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Source saved.asm', exact: true })).toHaveValue(
		changed
	);
	const records = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('mars-ts:workspace:v1')!)
	);
	expect(records).toContainEqual(
		expect.objectContaining({
			name: 'saved.asm',
			source: changed,
			savedSource: '.text\nnop\n',
			isNew: false
		})
	);
	expect(records).toContainEqual(
		expect.objectContaining({
			name: expect.stringMatching(/^mips\d+\.asm$/),
			source: draft,
			isNew: true
		})
	);
});

test('Open sorts filenames case-insensitively while cancel and reopening preserve in-progress source', async ({
	page
}) => {
	await openDesktop(page);
	const sources = [
		{ name: 'Zulu.asm', source: '# uppercase first letter\n' },
		{ name: 'working.asm', source: 'original\n' },
		{ name: 'alpha.asm', source: '# lowercase first letter\n' },
		{ name: 'program2.asm', source: '# lexical order, not numeric\n' },
		{ name: 'Beta.asm', source: '# uppercase middle name\n' },
		{ name: 'program10.asm', source: '# lexical order\n' },
		{ name: 'Alpha.asm', source: '# same folded name\n' }
	];
	await openStoredSources(page, sources, ['working.asm']);
	const source = page.getByRole('textbox', { name: 'Source working.asm', exact: true });
	await source.fill('modified in progress\n');
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	const open = page.getByRole('dialog', { name: 'Open', exact: true });
	await expect(open.locator('.source-files label')).toHaveText([
		'Alpha.asm',
		'alpha.asm',
		'Beta.asm',
		'program10.asm',
		'program2.asm',
		'working.asm',
		'Zulu.asm'
	]);
	await open.getByRole('checkbox', { name: 'working.asm', exact: true }).check();
	await open.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(source).toHaveValue('modified in progress\n');
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	await open.getByRole('checkbox', { name: 'working.asm', exact: true }).check();
	await open.getByRole('button', { name: 'Open', exact: true }).click();
	await expect(source).toHaveValue('modified in progress\n');
	await expect(page.getByRole('button', { name: 'Close working.asm', exact: true })).toHaveCount(1);
	await expect(page).toHaveTitle('* working.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual(sources);
});

test('Save As cancel preserves edits and a new name retains the original local source', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'original.asm', source: 'original source\n' }]);
	const changed = '.text\nli $t0, 77\n';
	await page.getByRole('textbox', { name: 'Source original.asm', exact: true }).fill(changed);
	await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
	const save = page.getByRole('dialog', { name: 'Save As', exact: true });
	await save.getByLabel('File name').fill('copy.asm');
	await save.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page).toHaveTitle('* original.asm - MARS');
	await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
	await save.getByLabel('File name').fill('copy.asm');
	await save.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveTitle('copy.asm - MARS');
	const records = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('mars-ts:sources:v1')!)
	);
	expect(records).toContainEqual({ name: 'original.asm', source: 'original source\n' });
	expect(records).toContainEqual({ name: 'copy.asm', source: changed });
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('textbox', { name: 'Source copy.asm', exact: true })).toHaveValue(
		changed
	);
	await expect(page).toHaveTitle('copy.asm - MARS');
});

test('Export and Export All download exact working source and closed library files without saving drafts', async ({
	page
}) => {
	await openDesktop(page);
	const exportAll = page.getByRole('button', { name: 'Export All', exact: true });
	await expect(exportAll).toBeDisabled();
	await openStoredSources(
		page,
		[
			{ name: 'closed.asm', source: '.text\nnop\n' },
			{ name: 'folder/closed.asm', source: '# nested source\n' },
			{ name: 'other/café.asm', source: '# café 中文\n' },
			{ name: 'empty.asm', source: '' },
			{ name: 'working.asm', source: '.text\nli $t0, 1\n' }
		],
		['working.asm']
	);
	await page.getByRole('button', { name: 'Close working.asm', exact: true }).click();
	await expect(exportAll).toBeEnabled();
	const libraryDownload = page.waitForEvent('download');
	await exportAll.click();
	const libraryZip = await libraryDownload;
	expect(libraryZip.suggestedFilename()).toBe('mars-asm-src-files.zip');
	expect(readArchive((await libraryZip.path())!)).toHaveLength(5);
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	const openDialog = page.getByRole('dialog', { name: 'Open', exact: true });
	await openDialog.getByRole('checkbox', { name: 'working.asm', exact: true }).check();
	await openDialog.getByRole('button', { name: 'Open', exact: true }).click();
	const current = '.text\nli $t0, 99\n# latest working source\n';
	await page.getByRole('textbox', { name: 'Source working.asm', exact: true }).fill(current);
	const autoSave = page.getByRole('button', { name: 'Auto Save', exact: true });
	const importButton = page.getByRole('button', { name: 'Import ...', exact: true });
	await expect(autoSave.locator('xpath=following-sibling::button[1]')).toHaveAttribute(
		'aria-label',
		'Import ...'
	);
	await expect(page.locator('.toolbar').getByRole('button', { name: /^Print/ })).toHaveCount(0);
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^File$/ })
		.click();
	await expect(page.locator('.menubar').getByRole('button', { name: /^Print/ })).toHaveCount(0);
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^File$/ })
		.click();
	const exportButton = page.getByRole('button', { name: 'Export', exact: true });
	await expect(importButton.locator('xpath=following-sibling::button[1]')).toHaveAttribute(
		'aria-label',
		'Export'
	);
	await expect(exportButton.locator('xpath=following-sibling::button[1]')).toHaveAttribute(
		'aria-label',
		'Export All'
	);
	const downloaded = page.waitForEvent('download');
	await exportButton.click();
	const single = await downloaded;
	expect(single.suggestedFilename()).toBe('working.asm');
	expect(await readFile((await single.path())!, 'utf8')).toBe(current);
	await expect(page).toHaveTitle('* working.asm - MARS');
	await expect(exportAll).toBeEnabled();
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const second = '.text\nli $t1, 7\n# second open buffer\n';
	await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill(second);
	await expect(exportAll).toBeEnabled();
	await page.getByRole('button', { name: '* working.asm', exact: true }).click();
	const downloads: import('@playwright/test').Download[] = [];
	page.on('download', (download) => downloads.push(download));
	await exportAll.click();
	await expect.poll(() => downloads.length).toBe(1);
	const archive = downloads[0];
	expect(archive.suggestedFilename()).toBe('mars-asm-src-files.zip');
	const contents = readArchive((await archive.path())!);
	expect(contents).toHaveLength(6);
	expect(contents).toEqual(
		expect.arrayContaining([
			{ name: 'closed.asm', source: '.text\nnop\n' },
			{ name: 'closed-2.asm', source: '# nested source\n' },
			{ name: 'café.asm', source: '# café 中文\n' },
			{ name: 'empty.asm', source: '' },
			{ name: 'working.asm', source: current },
			{ name: 'mips1.asm', source: second }
		])
	);
	expect(downloads).toHaveLength(1);
	await expect(page).toHaveTitle('* working.asm - MARS');
});

test('Import reads multiple assembly files into local sources and confirms clean replacements', async ({
	page
}) => {
	await openDesktop(page);
	const picker = page.getByLabel('Import assembly files', { exact: true });
	const chosen = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Import ...', exact: true }).click();
	const fileChooser = await chosen;
	expect(fileChooser.isMultiple()).toBe(true);
	await fileChooser.setFiles([
		{ name: 'one.asm', mimeType: 'text/plain', buffer: Buffer.from('.text\nnop\n') },
		{ name: 'two.asm', mimeType: 'text/plain', buffer: Buffer.from('.data\n.word 42\n') }
	]);
	await expect(page.getByRole('textbox', { name: 'Source two.asm', exact: true })).toHaveValue(
		'.data\n.word 42\n'
	);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual(
		expect.arrayContaining([
			{ name: 'one.asm', source: '.text\nnop\n' },
			{ name: 'two.asm', source: '.data\n.word 42\n' }
		])
	);
	const replacement = {
		name: 'two.asm',
		mimeType: 'text/plain',
		buffer: Buffer.from('.data\n.word 99\n')
	};
	await picker.setInputFiles([replacement]);
	const confirm = page.getByRole('dialog', { name: 'Replace imported sources?', exact: true });
	await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Source two.asm', exact: true })).toHaveValue(
		'.data\n.word 42\n'
	);
	await picker.setInputFiles([replacement]);
	await confirm.getByRole('button', { name: 'Replace', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Source two.asm', exact: true })).toHaveValue(
		'.data\n.word 99\n'
	);
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('textbox', { name: 'Source two.asm', exact: true })).toHaveValue(
		'.data\n.word 99\n'
	);
});

test('Save As requires confirmation before replacing a closed local source', async ({ page }) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'existing.asm', source: 'retained source\n' }]);
	await page.getByRole('button', { name: 'Close existing.asm', exact: true }).click();
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: /^Source mips\d+\.asm$/ }).fill('replacement source\n');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const save = page.getByRole('dialog', { name: 'Save As', exact: true });
	await save.getByLabel('File name').fill('existing.asm');
	await save.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(save.getByRole('button', { name: 'Replace', exact: true })).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'existing.asm', source: 'retained source\n' });
	await save.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.getByRole('textbox', { name: /^Source mips\d+\.asm$/ })).toHaveValue(
		'replacement source\n'
	);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await save.getByLabel('File name').fill('existing.asm');
	await save.getByRole('button', { name: 'Save', exact: true }).click();
	await save.getByRole('button', { name: 'Replace', exact: true }).click();
	await expect(page).toHaveTitle('existing.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'existing.asm', source: 'replacement source\n' });
});

test('Import refuses to overwrite a dirty open source and retains its full recovery text', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'working.asm', source: 'saved source\n' }]);
	const source = page.getByRole('textbox', { name: 'Source working.asm', exact: true });
	await source.fill('irreplaceable in-progress source\n');
	await page
		.getByLabel('Import assembly files', { exact: true })
		.setInputFiles([
			{ name: 'working.asm', mimeType: 'text/plain', buffer: Buffer.from('imported replacement\n') }
		]);
	const confirm = page.getByRole('dialog', { name: 'Replace imported sources?', exact: true });
	await confirm.getByRole('button', { name: 'Replace', exact: true }).click();
	await expect(confirm.getByRole('alert')).toHaveText(
		'Save or close the edited "working.asm" before replacing it.'
	);
	await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(source).toHaveValue('irreplaceable in-progress source\n');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'working.asm', source: 'saved source\n' });
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(source).toHaveValue('irreplaceable in-progress source\n');
	await expect(page).toHaveTitle('* working.asm - MARS');
});

test('Auto Save commits all working buffers, persists its setting, and disabling retains draft recovery', async ({
	page
}) => {
	await openDesktop(page);
	const autoSave = page.getByRole('button', { name: 'Auto Save', exact: true });
	await expect(autoSave).toHaveAttribute('aria-pressed', 'false');
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: 'Source mips1.asm', exact: true }).fill('first draft\n');
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const second = page.getByRole('textbox', { name: 'Source mips2.asm', exact: true });
	await second.fill('second draft\n');
	await autoSave.click();
	await expect(autoSave).toHaveAttribute('aria-pressed', 'true');
	await expect(page).toHaveTitle('mips2.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual(
		expect.arrayContaining([
			{ name: 'mips1.asm', source: 'first draft\n' },
			{ name: 'mips2.asm', source: 'second draft\n' }
		])
	);
	await second.fill('second automatic save\n');
	await expect
		.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!)))
		.toEqual(expect.arrayContaining([{ name: 'mips2.asm', source: 'second automatic save\n' }]));
	await page.reload();
	await waitForDesktop(page);
	await expect(autoSave).toHaveAttribute('aria-pressed', 'true');
	await expect(second).toHaveValue('second automatic save\n');
	await second.fill('automatic save after reload\n');
	await expect
		.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!)))
		.toEqual(
			expect.arrayContaining([{ name: 'mips2.asm', source: 'automatic save after reload\n' }])
		);
	await autoSave.click();
	await second.fill('protected draft with auto save off\n');
	await expect(page).toHaveTitle('* mips2.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'mips2.asm', source: 'automatic save after reload\n' });
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(autoSave).toHaveAttribute('aria-pressed', 'false');
	await expect(second).toHaveValue('protected draft with auto save off\n');
	await expect(page).toHaveTitle('* mips2.asm - MARS');
});

test('a source-library quota failure preserves the saved version and recovers the dirty working source', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'quota.asm', source: '.text\nnop\n' }]);
	await page.evaluate(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'mars-ts:sources:v1') {
				throw new DOMException('Source library quota exceeded', 'QuotaExceededError');
			}
			setItem.call(this, key, value);
		};
	});
	const draft = '.text\nli $t0, 1234\n# keep this unsaved source\n';
	const source = page.getByRole('textbox', { name: 'Source quota.asm', exact: true });
	await source.fill(draft);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const save = page.getByRole('dialog', { name: 'Save As', exact: true });
	await expect(save.getByRole('alert')).toContainText('Source library quota exceeded');
	await expect(page).toHaveTitle('* quota.asm - MARS');
	await expect(source).toHaveValue(draft);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'quota.asm', source: '.text\nnop\n' });
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:workspace:v1')!))
	).toContainEqual(
		expect.objectContaining({ name: 'quota.asm', source: draft, savedSource: '.text\nnop\n' })
	);
	await save.getByRole('button', { name: 'Cancel', exact: true }).click();
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(source).toHaveValue(draft);
	await expect(page).toHaveTitle('* quota.asm - MARS');
});

test('Auto Save retains the latest committed source when workspace backup fails before reload', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'saved.asm', source: '.text\nnop\n' }]);
	await page.getByRole('button', { name: 'Auto Save', exact: true }).click();
	await page.evaluate(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'mars-ts:workspace:v1') {
				throw new DOMException('Workspace quota exceeded', 'QuotaExceededError');
			}
			setItem.call(this, key, value);
		};
	});
	const latest = '.text\nli $t0, 4567\n# committed even though backup failed\n';
	const source = page.getByRole('textbox', { name: 'Source saved.asm', exact: true });
	await source.fill(latest);
	await expect(page.getByRole('alert')).toContainText('Workspace quota exceeded');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'saved.asm', source: latest });
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('button', { name: 'Auto Save', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(source).toHaveValue(latest);
	await expect(page).toHaveTitle('saved.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'saved.asm', source: latest });
});

test('conflicting dirty recovery preserves both versions and suspends Auto Save across tab selection', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [
		{ name: 'other.asm', source: '# another buffer\n' },
		{ name: 'conflict.asm', source: '# original saved A\n' }
	]);
	const source = page.getByRole('textbox', { name: 'Source conflict.asm', exact: true });
	await source.fill('# recovered draft B\n');
	await page.evaluate(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'mars-ts:workspace:v1') {
				throw new DOMException('Workspace quota exceeded', 'QuotaExceededError');
			}
			setItem.call(this, key, value);
		};
	});
	const autoSave = page.getByRole('button', { name: 'Auto Save', exact: true });
	await autoSave.click();
	await source.fill('# latest committed C\n');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'conflict.asm', source: '# latest committed C\n' });
	await page.reload();
	await waitForDesktop(page);
	await expect(source).toHaveValue('# recovered draft B\n');
	await expect(page).toHaveTitle('* conflict.asm - MARS');
	await expect(autoSave).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByRole('alert')).toContainText(
		'A recovered draft differs from its latest saved source'
	);
	await page.getByRole('button', { name: 'other.asm', exact: true }).click();
	await page.getByRole('button', { name: '* conflict.asm', exact: true }).click();
	await expect(source).toHaveValue('# recovered draft B\n');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toContainEqual({ name: 'conflict.asm', source: '# latest committed C\n' });
});

test('Delete confirms selected local sources, protects canceled drafts, and retains unrelated files', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(
		page,
		[
			{ name: 'closed.asm', source: '# closed saved source\n' },
			{ name: 'keep.asm', source: '# unrelated source\n' },
			{ name: 'working.asm', source: '# saved source\n' }
		],
		['keep.asm', 'working.asm']
	);
	const source = page.getByRole('textbox', { name: 'Source working.asm', exact: true });
	await source.fill('# edited source must survive cancel\n');
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	const open = page.getByRole('dialog', { name: 'Open', exact: true });
	await open.getByRole('checkbox', { name: 'closed.asm', exact: true }).check();
	await open.getByRole('checkbox', { name: 'working.asm', exact: true }).check();
	await open.getByRole('button', { name: 'Delete', exact: true }).click();
	const confirm = page.getByRole('dialog', { name: 'Delete sources?', exact: true });
	await expect(confirm).toContainText('closed.asm');
	await expect(confirm).toContainText('working.asm');
	await expect(confirm.getByRole('alert')).toContainText(/unsaved|edited|changes/i);
	await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(open.getByRole('checkbox', { name: 'closed.asm', exact: true })).toBeChecked();
	await expect(open.getByRole('checkbox', { name: 'working.asm', exact: true })).toBeChecked();
	await expect(source).toHaveValue('# edited source must survive cancel\n');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual(
		expect.arrayContaining([
			{ name: 'closed.asm', source: '# closed saved source\n' },
			{ name: 'working.asm', source: '# saved source\n' }
		])
	);
	await open.getByRole('button', { name: 'Delete', exact: true }).click();
	await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Close working.asm', exact: true })).toHaveCount(0);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual([{ name: 'keep.asm', source: '# unrelated source\n' }]);
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('textbox', { name: 'Source keep.asm', exact: true })).toHaveValue(
		'# unrelated source\n'
	);
	await expect(page.getByRole('button', { name: 'Close working.asm', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	await expect(open.getByRole('checkbox')).toHaveCount(1);
	await expect(open.getByRole('checkbox', { name: 'keep.asm', exact: true })).toBeVisible();
});

test('Save As Rename cancellation preserves both name and draft while confirmed rename moves exact source', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [{ name: 'original.asm', source: '# saved original\n' }]);
	const draft = '.text\nli $t0, 867\n# renamed working source\n';
	await page.getByRole('textbox', { name: 'Source original.asm', exact: true }).fill(draft);
	await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
	const save = page.getByRole('dialog', { name: 'Save As', exact: true });
	await save.getByLabel('File name').fill('renamed.asm');
	await save.getByRole('checkbox', { name: 'Rename existing file', exact: true }).check();
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveValue('original.asm');
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveAttribute('readonly', '');
	await save.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page).toHaveTitle('* original.asm - MARS');
	await expect(page.getByRole('textbox', { name: 'Source original.asm', exact: true })).toHaveValue(
		draft
	);
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual([{ name: 'original.asm', source: '# saved original\n' }]);
	await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
	await save.getByLabel('File name').fill('renamed.asm');
	await save.getByRole('checkbox', { name: 'Rename existing file', exact: true }).check();
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveValue('original.asm');
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveAttribute('readonly', '');
	await save.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveTitle('renamed.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual([{ name: 'renamed.asm', source: draft }]);
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByRole('textbox', { name: 'Source renamed.asm', exact: true })).toHaveValue(
		draft
	);
	await expect(page.getByRole('button', { name: 'Close original.asm', exact: true })).toHaveCount(
		0
	);
});

test('Rename requires confirmation before replacing an existing closed source', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(
		page,
		[
			{ name: 'original.asm', source: '# original source\n' },
			{ name: 'target.asm', source: '# previous target\n' }
		],
		['original.asm']
	);
	await page.getByRole('button', { name: 'Save as ...', exact: true }).click();
	const save = page.getByRole('dialog', { name: 'Save As', exact: true });
	await save.getByLabel('File name').fill('target.asm');
	await save.getByRole('checkbox', { name: 'Rename existing file', exact: true }).check();
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveValue('original.asm');
	await expect(save.getByLabel('Old filename', { exact: true })).toHaveAttribute('readonly', '');
	await save.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(save.getByRole('button', { name: 'Replace', exact: true })).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual(
		expect.arrayContaining([
			{ name: 'original.asm', source: '# original source\n' },
			{ name: 'target.asm', source: '# previous target\n' }
		])
	);
	await save.getByRole('button', { name: 'Replace', exact: true }).click();
	await expect(page).toHaveTitle('target.asm - MARS');
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1')!))
	).toEqual([{ name: 'target.asm', source: '# original source\n' }]);
});

test('Line and Column follows source focus while the selected filename stays visible', async ({
	page
}) => {
	await openDesktop(page);
	const position = page.locator('footer').getByText(/^Line \d+, Column \d+$/);
	await expect(position).toBeHidden();
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	await source.fill('one\ntwo\nabc');
	await source.press('Control+End');
	await expect(position).toHaveText('Line 3, Column 4');
	const filename = page.locator('footer > span').first();
	await expect(filename).toHaveText('mips1.asm');
	await page.getByLabel('$t0 value', { exact: true }).focus();
	await expect(position).toBeHidden();
	await expect(filename).toHaveText('mips1.asm');
	await source.focus();
	await expect(position).toHaveText('Line 3, Column 4');
	await page.getByRole('textbox', { name: 'Mars Messages', exact: true }).focus();
	await expect(position).toBeHidden();
	await expect(filename).toHaveText('mips1.asm');
	await page.getByRole('button', { name: 'Execute', exact: true }).click();
	await expect(position).toBeHidden();
	await expect(filename).toHaveText('mips1.asm');
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await expect(position).toBeHidden();
	await expect(filename).toHaveText('mips1.asm');
	await source.focus();
	await expect(position).toBeVisible();
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await expect(position).toBeHidden();
	await expect(filename).toHaveText('mips1.asm');
	await page.keyboard.press('Escape');
	await source.focus();
	await expect(position).toBeVisible();
	await page.getByRole('button', { name: 'Close mips1.asm', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Save changes?', exact: true })
		.getByRole('button', { name: 'Discard', exact: true })
		.click();
	await expect(position).toBeHidden();
});

// Decode with an independent ZIP reader, which also verifies entry CRCs.
function readArchive(path: string): { name: string; source: string }[] {
	execFileSync('unzip', ['-t', path]);
	const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trimEnd().split('\n');
	return names.map((name) => ({
		name,
		source: execFileSync('unzip', ['-p', path, name], { encoding: 'utf8' })
	}));
}

test('new empty buffers stay unsaved until the first character, including with Auto Save', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	const savedSources = () =>
		page.evaluate(() => JSON.parse(localStorage.getItem('mars-ts:sources:v1') ?? '[]'));
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	await source.press('Control+s');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^File$/ })
		.click();
	await page.getByRole('button', { name: 'Save All', exact: true }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	expect(await savedSources()).toEqual([]);
	await page.getByRole('button', { name: 'Auto Save', exact: true }).click();
	expect(await savedSources()).toEqual([]);
	await source.press('Alt+n');
	expect(await savedSources()).toEqual([]);
	const second = page.getByRole('textbox', { name: 'Source mips2.asm', exact: true });
	// Whitespace counts as a character; only truly empty new buffers are deferred.
	await second.fill(' ');
	await expect.poll(savedSources).toEqual([{ name: 'mips2.asm', source: ' ' }]);
	await second.fill('');
	await expect.poll(savedSources).toEqual([{ name: 'mips2.asm', source: '' }]);
	await page.getByRole('button', { name: '* mips1.asm', exact: true }).click();
	await source.fill('x');
	await expect.poll(savedSources).toEqual(
		expect.arrayContaining([
			{ name: 'mips1.asm', source: 'x' },
			{ name: 'mips2.asm', source: '' }
		])
	);
});
