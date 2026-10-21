import { expect, test } from '@playwright/test';
import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';

const action = (page: import('@playwright/test').Page, name: string) =>
	page.getByRole('button', { name, exact: true });

test('reload restores Edit selection independently of the exact loaded machine, console output, and Backstep history', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [
		{
			name: 'loaded.asm',
			source:
				'.data\nvalue: .word 11\n.text\nli $t0, 7\nli $a0, 42\nli $v0, 1\nsyscall\nli $v0, 10\nsyscall\n'
		},
		{ name: 'editing.asm', source: '# independent editor\n' }
	]);
	await action(page, 'loaded.asm').click();
	await action(page, 'Assemble').click();
	for (let i = 0; i < 4; i++) await action(page, 'Step').click();
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('42');
	await page.getByLabel('Memory 0x10010000', { exact: true }).fill('99');
	await page.getByLabel('Memory 0x10010000', { exact: true }).press('Enter');
	await page.getByLabel('Breakpoint 0x00400014', { exact: true }).check();
	await action(page, 'Edit').click();
	await action(page, 'editing.asm').click();
	await page.getByRole('textbox', { name: 'Source editing.asm', exact: true }).press('Control+End');
	await page.reload();
	await waitForDesktop(page);
	await expect(page.locator('footer > span').first()).toHaveText('Editing: editing.asm');
	await expect(page.getByLabel('Execution status')).toHaveCount(0);
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('42');
	await action(page, 'Execute').click();
	await expect(page.locator('footer > span').first()).toHaveText('Loaded: loaded.asm');
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000007');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400010');
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x00000063');
	await expect(page.getByLabel('Breakpoint 0x00400014', { exact: true })).toBeChecked();
	await action(page, 'Backstep').click();
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x0040000c');
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue('42');
	await page.getByLabel('Breakpoint 0x00400014', { exact: true }).uncheck();
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	const output = await page.getByLabel('Run I/O', { exact: true }).inputValue();
	await action(page, 'Mars Messages').click();
	const messages = await page.getByLabel('Mars Messages', { exact: true }).inputValue();
	await page.reload();
	await waitForDesktop(page);
	await expect(page.locator('footer > span').first()).toHaveText('Loaded: loaded.asm');
	await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
	await expect(action(page, 'Go')).toBeDisabled();
	await expect(page.getByLabel('Mars Messages', { exact: true })).toHaveValue(messages);
	await action(page, 'Run I/O').click();
	await expect(page.getByLabel('Run I/O', { exact: true })).toHaveValue(output);
	await action(page, 'Reset').click();
	await expect(page.getByLabel('Memory 0x10010000', { exact: true })).toHaveValue('0x0000000b');
});

test('reload during execution returns to the previous stable checkpoint instead of resuming mid-flight', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(page, [
		{ name: 'loop.asm', source: '.text\nli $t0, 3\nloop: addiu $t0, $t0, 1\nb loop\n' }
	]);
	await action(page, 'Assemble').click();
	await action(page, 'Step').click();
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000003');
	await action(page, 'Go').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
	await page.reload();
	await waitForDesktop(page);
	await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
	await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000003');
	await expect(page.getByLabel('pc value', { exact: true })).toHaveValue('0x00400004');
	await expect(action(page, 'Pause')).toBeDisabled();
});

test('reload retains assembly errors, console diagnostics, source caret, and edit undo history', async ({
	page
}) => {
	await openDesktop(page);
	await action(page, 'New').click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	await source.fill('invalid_instruction');
	await source.press('Control+End');
	await action(page, 'Assemble').click();
	await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
	const messages = await page.getByLabel('Mars Messages', { exact: true }).inputValue();
	await page.reload();
	await waitForDesktop(page);
	await expect(page.locator('footer > span').first()).toHaveText('Editing: mips1.asm');
	await expect(page.getByLabel('Execution status')).toHaveText('Status: error');
	await expect(page.getByLabel('Mars Messages', { exact: true })).toHaveValue(messages);
	await source.focus();
	await expect(page.locator('footer')).toContainText('Line 1, Column 20');
	await action(page, 'Undo').click();
	await expect(source).toHaveValue('');
	await expect(page.getByLabel('Execution status')).toHaveCount(0);
});
