import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';
import { test, expect, type Page } from '@playwright/test';

async function source(page: Page, text: string) {
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: /^Source / }).fill(text);
}

const finished = '\n-- program is finished running --\n\n';

const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('Text Segment heading stays visible while following and scrolling instructions', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.text\nmain:\n' + 'nop\n'.repeat(80) + 'li $v0,10\nsyscall\n');
	await action(page, 'Assemble').click();
	const text = page.getByRole('region', { name: 'Text Segment', exact: true });
	const heading = text.getByRole('heading', { name: 'Text Segment', exact: true });
	await expect(heading).toBeInViewport();
	await page.getByLabel('Breakpoint 0x004000c8', { exact: true }).check();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(heading).toBeInViewport();
	const bounds = await text.evaluate((panel) => ({
		headingBottom: panel.querySelector('h2')!.getBoundingClientRect().bottom,
		columnsTop: panel.querySelector('th')!.getBoundingClientRect().top,
		columnsBottom: panel.querySelector('th')!.getBoundingClientRect().bottom,
		currentTop: panel.querySelector('tr.current')!.getBoundingClientRect().top
	}));
	expect(bounds.columnsTop).toBeGreaterThanOrEqual(bounds.headingBottom - 1);
	expect(bounds.currentTop).toBeGreaterThanOrEqual(bounds.columnsBottom - 1);
	await text.locator('table').evaluate((table) => {
		table.parentElement!.scrollTop = table.parentElement!.scrollHeight;
	});
	await expect(heading).toBeInViewport();
});

test('breakpoint toolbar actions follow Reset and suspend or clear breakpoints', async ({
	page
}) => {
	await openDesktop(page);
	const reset = action(page, 'Reset');
	const clear = action(page, 'Clear all breakpoints');
	const toggle = action(page, 'Toggle all breakpoints');
	await expect(reset.locator('xpath=following-sibling::button[1]')).toHaveAttribute(
		'aria-label',
		'Toggle all breakpoints'
	);
	await expect(toggle.locator('xpath=following-sibling::button[1]')).toHaveAttribute(
		'aria-label',
		'Clear all breakpoints'
	);
	await expect(clear).toBeDisabled();
	await expect(toggle).toBeDisabled();
	await page.locator('.menubar summary').filter({ hasText: /^Run$/ }).click();
	await expect(
		page.locator('.menubar').getByRole('button', { name: /all breakpoints/ })
	).toHaveCount(0);
	await source(page, '.text\naddiu $t0,$zero,1\naddiu $t0,$t0,1\nli $v0,10\nsyscall\n');
	await action(page, 'Assemble').click();
	const breakpoint = page.getByLabel('Breakpoint 0x00400004', { exact: true });
	await breakpoint.check();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(breakpoint).toBeChecked();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText(
		'Status: terminated — breakpoints suspended'
	);
	await action(page, 'Reset').click();
	await toggle.click();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400004');
	await clear.click();
	await expect(breakpoint).not.toBeChecked();
	await expect(clear).toBeDisabled();
	await expect(toggle).toBeDisabled();
});

test('Labels filters data and text and sorts names or unsigned addresses in both directions', async ({
	page
}) => {
	await openDesktop(page);
	await source(
		page,
		'.data\nzData: .word 1\n.globl AlphaData\nAlphaData: .word 2\n.text\nzText: nop\nalphaText: nop\n.kdata\nKernel: .word 3\n'
	);
	await action(page, 'Show Labels Window').click();
	await action(page, 'Assemble').click();
	const labels = page.getByRole('region', { name: 'Labels', exact: true });
	const names = labels.locator('tbody tr td:first-child');
	const headings = labels.getByRole('rowheader');
	await expect(headings).toHaveText(['(global)', 'mips1.asm']);
	await expect(names).toHaveText(['AlphaData', 'zText', 'alphaText', 'zData', 'Kernel']);
	await labels.getByRole('button', { name: 'Sort by Label', exact: true }).click();
	await expect(names).toHaveText(['AlphaData', 'alphaText', 'Kernel', 'zData', 'zText']);
	await labels.getByRole('button', { name: 'Sort by Label', exact: true }).click();
	await expect(names).toHaveText(['AlphaData', 'zText', 'zData', 'Kernel', 'alphaText']);
	await labels.getByRole('checkbox', { name: 'Data', exact: true }).uncheck();
	await expect(names).toHaveText(['zText', 'alphaText']);
	await labels.getByRole('checkbox', { name: 'Text', exact: true }).uncheck();
	await expect(names).toHaveCount(0);
	await expect(headings).toHaveText(['(global)', 'mips1.asm']);
	await labels.getByRole('checkbox', { name: 'Data', exact: true }).check();
	await labels.getByRole('button', { name: 'Sort by Address', exact: true }).click();
	await expect(names).toHaveText(['AlphaData', 'zData', 'Kernel']);
	await labels.getByRole('button', { name: 'Sort by Address', exact: true }).click();
	await expect(names).toHaveText(['AlphaData', 'Kernel', 'zData']);
	await action(page, 'Addresses displayed in hexadecimal').click();
	await expect(names).toHaveText(['AlphaData', 'Kernel', 'zData']);
	await expect(labels.getByRole('columnheader', { name: /Address/ })).toHaveAttribute(
		'aria-sort',
		'descending'
	);
	await labels.getByRole('button', { name: 'AlphaData', exact: true }).click();
	await expect(page.getByLabel('Memory 0x10010004', { exact: true })).toHaveValue('0x00000002');
	await action(page, 'Show Labels Window').click();
	await action(page, 'Show Labels Window').click();
	await expect(names).toHaveText(['AlphaData', 'Kernel', 'zData']);
	await page.screenshot({ path: '__build/labels-toolbar.png', fullPage: true });
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(action(page, 'New')).toBeEnabled();
	await action(page, 'Execute').click();
	await expect(labels.getByRole('checkbox', { name: 'Text', exact: true })).not.toBeChecked();
	await expect(labels.getByRole('checkbox', { name: 'Data', exact: true })).toBeChecked();
	await expect(labels.getByRole('columnheader', { name: /Address/ })).toHaveAttribute(
		'aria-sort',
		'descending'
	);
});

test('Labels separates exported temperature strings from file-local branches and updates after reassembly', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(
		page,
		[
			{
				name: 'temperature.asm',
				source: `.globl welcome
.globl selection
.globl promptC
.globl promptF
.globl sumTextC
.globl sumTextF
.data
welcome: .asciiz "Temperature converter"
selection: .asciiz "Select 0 for C->F, or 1 for F->C: "
promptC: .asciiz "Celsius: "
promptF: .asciiz "Fahrenheit: "
sumTextC: .asciiz "F = "
sumTextF: .asciiz "C = "
.text
main: nop
if: bnez $s0, else
j endif
else: nop
endif: li $v0, 10
syscall
`
			},
			{ name: 'local-only.asm', source: '.text\nonlyLocal: nop\n' }
		],
		['temperature.asm']
	);
	await action(page, 'Show Labels Window').click();
	await action(page, 'Assemble').click();
	const labels = page.getByRole('region', { name: 'Labels', exact: true });
	const headings = labels.getByRole('rowheader');
	const globals = labels.getByRole('rowgroup', { name: '(global)', exact: true });
	const locals = labels.getByRole('rowgroup', { name: 'temperature.asm', exact: true });
	await expect(headings).toHaveText(['(global)', 'temperature.asm']);
	await expect(headings.nth(0)).toHaveCSS('text-align', 'center');
	await expect(headings.nth(1)).toHaveCSS('text-align', 'center');
	await expect(labels.getByRole('button', { name: 'Sort by Address', exact: true })).toHaveText(
		'Address ▲'
	);
	await expect(globals.locator('td:first-child')).toHaveText([
		'welcome',
		'selection',
		'promptC',
		'promptF',
		'sumTextC',
		'sumTextF'
	]);
	await expect(locals.locator('td:first-child')).toHaveText(['main', 'if', 'else', 'endif']);
	await labels.getByRole('button', { name: 'Sort by Label', exact: true }).click();
	await expect(labels.getByRole('button', { name: 'Sort by Label', exact: true })).toHaveText(
		'Label ▲'
	);
	await expect(headings).toHaveText(['(global)', 'temperature.asm']);
	await expect(globals.locator('td:first-child')).toHaveText([
		'promptC',
		'promptF',
		'selection',
		'sumTextC',
		'sumTextF',
		'welcome'
	]);
	await expect(locals.locator('td:first-child')).toHaveText(['else', 'endif', 'if', 'main']);
	await page.screenshot({ path: '__build/labels-symbol-groups.png', fullPage: true });
	await action(page, 'Open ...').click();
	const open = page.getByRole('dialog', { name: 'Open', exact: true });
	await open.getByRole('checkbox', { name: 'local-only.asm', exact: true }).check();
	await open.getByRole('button', { name: 'Open', exact: true }).click();
	await action(page, 'Assemble').click();
	await expect(headings).toHaveText(['local-only.asm']);
	await expect(labels.locator('tbody td:first-child')).toHaveText(['onlyLocal']);
});

test('data pages show sixteen rows and ASCII follows hexadecimal values inline', async ({
	page
}) => {
	await page.route('**/icons/Previous.svg', (route) => route.abort());
	await page.route('**/icons/Next.svg', (route) => route.abort());
	await openDesktop(page);
	await source(page, '.data\n.word 0x44434241\n.text\nnop\n');
	await action(page, 'Assemble').click();
	const data = page.getByRole('region', { name: 'Data Segment', exact: true });
	await expect(action(page, 'Previous memory page').locator('svg')).toBeVisible();
	await expect(action(page, 'Next memory page').locator('svg')).toBeVisible();
	await expect(data.locator('tbody tr')).toHaveCount(16);
	await expect(data.locator('tbody tr').last()).toContainText('0x100101e0');
	await expect(data.locator('tbody tr').last()).toBeInViewport();
	const hexadecimal = page.getByRole('checkbox', { name: 'Hexadecimal Values', exact: true });
	const ascii = page.getByRole('checkbox', { name: 'ASCII', exact: true });
	const asciiToolbar = action(page, 'Display Data Segment values as ASCII');
	await expect(
		action(page, 'Addresses displayed in hexadecimal').locator('xpath=following-sibling::button[1]')
	).toHaveAttribute('aria-label', 'Values displayed in hexadecimal');
	await expect(
		action(page, 'Values displayed in hexadecimal').locator('xpath=following-sibling::button[1]')
	).toHaveAttribute('aria-label', 'Display Data Segment values as ASCII');
	await expect(asciiToolbar).toHaveAttribute('aria-pressed', 'false');
	const hexBox = await hexadecimal.boundingBox();
	const asciiBox = await ascii.boundingBox();
	expect(asciiBox!.x).toBeGreaterThan(hexBox!.x);
	expect(Math.abs(asciiBox!.y - hexBox!.y)).toBeLessThan(2);
	const rangeBox = await page.getByRole('combobox', { name: 'Data segment base' }).boundingBox();
	expect(
		Math.abs(rangeBox!.y + rangeBox!.height / 2 - (asciiBox!.y + asciiBox!.height / 2))
	).toBeLessThan(3);
	await expect(data.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
	await asciiToolbar.click();
	await expect(ascii).toBeChecked();
	await expect(asciiToolbar).toHaveAttribute('aria-pressed', 'true');
	const word = page.getByLabel('Memory 0x10010000', { exact: true });
	await expect(word).toHaveValue('  D  C  B  A');
	await expect(word).toHaveAttribute('readonly', '');
	await ascii.uncheck();
	await expect(asciiToolbar).toHaveAttribute('aria-pressed', 'false');
	await expect(word).toHaveValue('0x44434241');
	await action(page, 'Next memory page').click();
	await expect(data.locator('tbody tr').first()).toContainText('0x10010200');
	await action(page, 'Previous memory page').click();
	await expect(data.locator('tbody tr').first()).toContainText('0x10010000');
	const range = page.getByRole('combobox', { name: 'Data segment base' });
	await expect(range.locator('option:not([hidden])')).toHaveText([
		'0x10000000 (.extern)',
		'0x10010000 (.data)',
		'0x10040000 (heap)',
		'current $gp',
		'current $sp',
		'0x00400000 (.text)',
		'0x90000000 (.kdata)',
		'0xffff0000 (MMIO)'
	]);
	await range.selectOption('heap');
	await expect(data.locator('tbody tr').first()).toContainText('0x10040000');
	await range.selectOption('gp');
	await expect(data.locator('tbody tr').first()).toContainText('0x10008000');
	await ascii.check();
	await expect(asciiToolbar).toHaveAttribute('aria-pressed', 'true');
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(action(page, 'New')).toBeEnabled();
	await expect(asciiToolbar).toHaveAttribute('aria-pressed', 'true');
	await expect(range).toHaveValue('gp');
	await expect(data.locator('tbody tr').first()).toContainText('0x10008000');
	await action(page, 'Assemble').click();
	await expect(ascii).toBeChecked();
	await range.selectOption('data');
	await expect(word).toHaveValue('  D  C  B  A');
});

test('real assembly, stepping, backstep, breakpoint, memory edit, run output, and reset', async ({
	page
}) => {
	await openDesktop(page);
	await source(
		page,
		`.data
result: .word 11
.text
main:
addiu $t0,$zero,5
addiu $t0,$t0,2
sw $t0,result
li $a0,42
li $v0,1
syscall
li $v0,10
syscall
`
	);
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await expect(
		page.getByRole('region', { name: 'Text Segment', exact: true }).getByRole('row')
	).toHaveCount(10);
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x0000000b');
	await action(page, 'Step').click();
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000005');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400004');
	await action(page, 'Backstep').click();
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000000');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400000');
	await page.getByLabel('Breakpoint 0x00400008', { exact: true }).check();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400008');
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('42' + finished);
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x00000007');
	await page.getByLabel('Memory 0x10010000', { exact: true }).fill('99');
	await page.getByLabel('Memory 0x10010000', { exact: true }).press('Enter');
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x00000063');
	await action(page, 'Reset').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x0000000b');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000000');
});

test('console syscall input resumes execution and popup input cancels through Stop', async ({
	page
}) => {
	await openDesktop(page);
	await source(
		page,
		'.text\nli $v0,5\nsyscall\nmove $a0,$v0\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n'
	);
	await action(page, 'Assemble').click();
	await action(page, 'Go').click();
	await page.getByLabel('Run input', { exact: true }).fill('-42');
	await action(page, 'Submit').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('-42\n-42' + finished);
	await page.getByRole('button', { name: 'Popup dialog for input syscalls', exact: true }).click();
	await action(page, 'Reset').click();
	await action(page, 'Go').click();
	await expect(page.getByRole('dialog', { name: 'Run Input', exact: true })).toBeVisible();
	await page.getByLabel('Syscall input', { exact: true }).fill('17');
	await page.mouse.click(10, 10);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await expect(page.getByLabel('$v0 value', { exact: true })).toHaveValue('0x00000011');
});

test('unlimited execution yields to Pause and Stop and source edits invalidate execution', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.text\nloop: addiu $t0,$t0,1\nb loop\n');
	await action(page, 'Assemble').click();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
	await action(page, 'Pause').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).not.toHaveValue('0x00000000');
	await action(page, 'Go').click();
	await action(page, 'Stop').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await action(page, 'Reset').click();
	await action(page, 'Edit').click();
	await page.getByRole('textbox', { name: /^Source / }).fill('.text\ninvalid_instruction\n');
	await expect(action(page, 'Go')).toBeDisabled();
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Mars Messages', { exact: true })).toHaveValue(
		/invalid_instruction/
	);
	await expect(action(page, 'Go')).toBeDisabled();
});

test('active-source assembly uses explicit unsaved includes and retires saved assemble-all settings', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('mars-ts:engine-settings:v1:AssembleAll', 'true');
	});
	await openDesktop(page);
	await source(
		page,
		'.text\n.globl main\nmain: jal compute\nmove $a0,$v0\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n.include "mips2.asm"\n'
	);
	await source(page, '.text\n.globl compute\ncompute: li $v0,73\njr $ra\n');
	await source(page, 'invalid_instruction\n');
	await page.getByRole('button', { name: /^\*? ?mips1\.asm$/ }).click();
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await expect(page.getByLabel('Assemble all open files in editor', { exact: true })).toHaveCount(
		0
	);
	expect(
		await page.evaluate(() => localStorage.getItem('mars-ts:engine-settings:v1:AssembleAll'))
	).toBe('false');
	await page
		.getByLabel('Initialize Program Counter to global main if defined', { exact: true })
		.check();
	await page.getByRole('button', { name: 'Show Labels Window', exact: true }).click();
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await expect(
		page
			.getByRole('region', { name: 'Labels', exact: true })
			.getByRole('button', { name: 'compute', exact: true })
	).toBeVisible();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('73' + finished);
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await expect(action(page, 'New')).toBeEnabled({ timeout: 30000 });
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await expect(page.getByLabel('Assemble all open files in editor', { exact: true })).toHaveCount(
		0
	);
	expect(
		await page.evaluate(() => localStorage.getItem('mars-ts:engine-settings:v1:AssembleAll'))
	).toBe('false');
	await expect(
		page.getByLabel('Initialize Program Counter to global main if defined', { exact: true })
	).toBeChecked();
});

test('closed local includes feed the real tokenizer and floating registers use exact numeric conversion', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(
		page,
		[
			{ name: 'constants.inc', source: '.eqv ANSWER 19\n' },
			{
				name: 'main.asm',
				source:
					'.include "constants.inc"\n.text\nli $a0,ANSWER\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n'
			}
		],
		['main.asm']
	);
	await expect(page.getByRole('button', { name: 'Close constants.inc', exact: true })).toHaveCount(
		0
	);
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await action(page, 'Go').click();
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('19' + finished);
	await action(page, 'Coproc 1').click();
	await page.getByLabel('$f0 float value', { exact: true }).fill('1.5');
	await page.getByLabel('$f0 float value', { exact: true }).press('Enter');
	await expect(page.getByLabel('$f0 float value', { exact: true })).toHaveValue('0x3fc00000');
	await page.getByLabel('$f2 double value', { exact: true }).fill('-2.5');
	await page.getByLabel('$f2 double value', { exact: true }).press('Enter');
	await expect(page.getByLabel('$f2 double value', { exact: true })).toHaveValue(
		'0xc004000000000000'
	);
});

test('cliff and exception outcomes preserve messages and select the faulting instruction', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.text\naddiu $t0,$zero,1\n');
	await action(page, 'Assemble').click();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue(
		'\n-- program is finished running (dropped off bottom) --\n\n'
	);
	await action(page, 'Reset').click();
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue(
		'\n-- program is finished running (dropped off bottom) --\n\n\nReset: reset completed.\n\n'
	);
	await action(page, 'Edit').click();
	await page.getByRole('textbox', { name: /^Source / }).fill('.text\nli $t0,1\nteq $t0,$t0\n');
	await action(page, 'Assemble').click();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
	await expect(action(page, 'Coproc 0')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByLabel('Mars Messages', { exact: true })).toHaveValue(
		/Go: execution terminated with errors/
	);
	await expect(page.locator('tr[aria-current="step"]')).toContainText('teq');
});

test('Data Segment resizes from above and reselecting its range returns to the start', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.data\n.word 1\n.text\nnop\n');
	await action(page, 'Assemble').click();
	const data = page.getByRole('region', { name: 'Data Segment', exact: true });
	const scroll = data.locator('.data-scroll');
	const divider = page.getByRole('separator', { name: 'Data Segment height' });
	const natural = Number(await divider.getAttribute('aria-valuenow'));
	expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(false);
	const box = (await divider.boundingBox())!;
	await page.mouse.move(box.x + 100, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 100, box.y + box.height / 2 + 150);
	await page.mouse.up();
	await expect(divider).toHaveAttribute('aria-valuenow', String(natural - 150));
	expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
	await expect(data.getByRole('heading', { name: 'Data Segment' })).toBeInViewport();
	await expect(action(page, 'Next memory page')).toBeInViewport();
	await scroll.evaluate((node) => (node.scrollTop = node.scrollHeight));
	await expect(data.locator('tbody tr').last()).toBeInViewport();
	await expect(data.locator('th').first()).toBeInViewport();
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByRole('button', { name: 'Execute', exact: true }).click();
	await expect(divider).toHaveAttribute('aria-valuenow', String(natural - 150));
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await waitForDesktop(page);
	await action(page, 'Assemble').click();
	await expect(divider).toHaveAttribute('aria-valuenow', String(natural - 150));
	const restore = action(page, 'Restore full Data Segment height');
	await expect(restore).toBeEnabled();
	await restore.click();
	await expect(divider).toHaveAttribute('aria-valuenow', String(natural));
	await expect(restore).toBeDisabled();
	await divider.press('ArrowDown');
	await expect(restore).toBeEnabled();
	await divider.press('End');
	await expect(divider).toHaveAttribute('aria-valuenow', String(natural));
	await expect(restore).toBeDisabled();
	const range = page.getByRole('combobox', { name: 'Data segment base' });
	await action(page, 'Next memory page').click();
	await expect(data.locator('tbody tr').first()).toContainText('0x10010200');
	await range.focus();
	await range.dispatchEvent('pointerdown');
	await expect(range.locator('option:checked')).toHaveText('0x10010000 (.data)');
	await range.blur();
	await expect(range).toHaveValue('data');
	await expect(data.locator('tbody tr').first()).toContainText('0x10010200');
	await range.dispatchEvent('pointerdown');
	await range.selectOption('data');
	await expect(range).toHaveValue('data');
	await expect(data.locator('tbody tr').first()).toContainText('0x10010000');
});

test('text memory is readable without SMC and editable code executes then resets to the original', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.text\naddiu $t0,$zero,1\nli $v0,10\nsyscall\n');
	await action(page, 'Assemble').click();
	await page.getByLabel('Data segment base', { exact: true }).selectOption('text');
	await expect(page.getByLabel('Memory 0x00400000', { exact: true })).toHaveValue('0x24080001');
	await expect(page.getByLabel('Code 0x00400000', { exact: true })).toHaveAttribute('readonly', '');
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await expect(page.getByLabel('Self-modifying code', { exact: true })).not.toBeChecked();
	await page.getByLabel('Self-modifying code', { exact: true }).check();
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await page.getByLabel('Code 0x00400000', { exact: true }).fill('0x24080009');
	await page.getByLabel('Code 0x00400000', { exact: true }).press('Enter');
	await expect(page.getByLabel('Memory 0x00400000', { exact: true })).toHaveValue('0x24080009');
	await expect(page.getByRole('region', { name: 'Text Segment', exact: true })).toContainText(
		'------'
	);
	await action(page, 'Step').click();
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000009');
	await action(page, 'Reset').click();
	await expect(page.getByLabel('Code 0x00400000', { exact: true })).toHaveValue('0x24080001');
	await expect(page.getByRole('region', { name: 'Text Segment', exact: true })).not.toContainText(
		'------'
	);
});
