import { openDesktop } from './openDesktop.js';
import { test, expect, type Page } from '@playwright/test';

async function source(page: Page, text: string) {
	await page.getByRole('button', { name: 'New', exact: true }).click();
	await page.getByRole('textbox', { name: /^Source / }).fill(text);
}

const finished = '\n-- program is finished running --\n\n';

const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

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
	await expect(page.getByLabel('Execution status')).toHaveText('assembled');
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
	await expect(page.getByLabel('Execution status')).toHaveText('paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400008');
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('42' + finished);
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x00000007');
	await page.getByLabel('Memory 0x10010000', { exact: true }).fill('99');
	await page.getByLabel('Memory 0x10010000', { exact: true }).press('Enter');
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x00000063');
	await action(page, 'Reset').click();
	await expect(page.getByLabel('Execution status')).toHaveText('assembled');
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
	await expect(page.getByLabel('Execution status')).toHaveText('terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('-42\n-42' + finished);
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await page.getByLabel('Popup dialog for input syscalls', { exact: true }).check();
	await action(page, 'Reset').click();
	await action(page, 'Go').click();
	await expect(page.getByRole('dialog', { name: 'Run Input', exact: true })).toBeVisible();
	await page.getByLabel('Syscall input', { exact: true }).fill('17');
	await page.mouse.click(10, 10);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByLabel('Execution status')).toHaveText('terminated');
	await expect(page.getByLabel('$v0 value', { exact: true })).toHaveValue('0x00000011');
});

test('unlimited execution yields to Pause and Stop and source edits invalidate execution', async ({
	page
}) => {
	await openDesktop(page);
	await source(page, '.text\nloop: addiu $t0,$t0,1\nb loop\n');
	await action(page, 'Assemble').click();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('running');
	await action(page, 'Pause').click();
	await expect(page.getByLabel('Execution status')).toHaveText('paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).not.toHaveValue('0x00000000');
	await action(page, 'Go').click();
	await action(page, 'Stop').click();
	await expect(page.getByLabel('Execution status')).toHaveText('terminated');
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

test('all-open assembly uses unsaved buffers and persists engine settings', async ({ page }) => {
	await openDesktop(page);
	await source(
		page,
		'.text\n.globl main\nmain: jal compute\nmove $a0,$v0\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n'
	);
	await source(page, '.text\n.globl compute\ncompute: li $v0,73\njr $ra\n');
	await page.getByRole('button', { name: /^\*? ?mips1\.asm$/ }).click();
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await page.getByLabel('Assemble all open files in editor', { exact: true }).check();
	await page
		.getByLabel('Initialize Program Counter to global main if defined', { exact: true })
		.check();
	await page.getByLabel('Show Labels Window', { exact: true }).check();
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('assembled');
	await expect(
		page
			.getByRole('region', { name: 'Labels', exact: true })
			.getByRole('button', { name: 'compute', exact: true })
	).toBeVisible();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('terminated');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('73' + finished);
	page.once('dialog', (dialog) => dialog.accept());
	await page.reload();
	await expect(action(page, 'New')).toBeEnabled();
	await page
		.locator('.menubar summary')
		.filter({ hasText: /^Settings$/ })
		.click();
	await expect(page.getByLabel('Assemble all open files in editor', { exact: true })).toBeChecked();
	await expect(
		page.getByLabel('Initialize Program Counter to global main if defined', { exact: true })
	).toBeChecked();
});

test('open includes feed the real tokenizer and floating registers use exact numeric conversion', async ({
	page
}) => {
	await openDesktop(page);
	await page.getByLabel('Open assembly files', { exact: true }).setInputFiles([
		{ name: 'constants.inc', mimeType: 'text/plain', buffer: Buffer.from('.eqv ANSWER 19\n') },
		{
			name: 'main.asm',
			mimeType: 'text/plain',
			buffer: Buffer.from(
				'.include "constants.inc"\n.text\nli $a0,ANSWER\nli $v0,1\nsyscall\nli $v0,10\nsyscall\n'
			)
		}
	]);
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('assembled');
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
	await expect(page.getByLabel('Execution status')).toHaveText('error');
	await expect(action(page, 'Coproc 0')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByLabel('Mars Messages', { exact: true })).toHaveValue(
		/Go: execution terminated with errors/
	);
	await expect(page.locator('tr[aria-current="step"]')).toContainText('teq');
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
	await expect(page.getByLabel('Execution status')).toHaveText('assembled');
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
