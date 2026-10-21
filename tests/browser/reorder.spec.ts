import { expect, test } from '@playwright/test';
import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';

test('dragging source tabs preserves selection, dirty contents, loaded execution, and restored order', async ({
	page
}) => {
	await openDesktop(page);
	await openStoredSources(
		page,
		['a.asm', 'b.asm', 'c.asm'].map((name) => ({ name, source: '.text\nnop\n' }))
	);
	const action = (name: string) => page.getByRole('button', { name, exact: true });
	await action('b.asm').click();
	const source = page.getByRole('textbox', { name: 'Source b.asm', exact: true });
	await source.fill('.text\nli $t0, 9\n');
	await action('Assemble').click();
	await action('Edit').click();
	await action('c.asm').dragTo(action('a.asm'), { targetPosition: { x: 3, y: 10 } });
	await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', 'a.asm', '* b.asm']);
	await expect(action('* b.asm')).toHaveAttribute('aria-pressed', 'true');
	await expect(source).toHaveValue('.text\nli $t0, 9\n');
	await action('a.asm').dragTo(action('* b.asm'), { targetPosition: { x: 45, y: 10 } });
	await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
	await page.reload();
	await waitForDesktop(page);
	await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
	await expect(action('* b.asm')).toHaveAttribute('aria-pressed', 'true');
	await expect(source).toHaveValue('.text\nli $t0, 9\n');
	await action('Execute').click();
	await expect(page.locator('footer > span').first()).toHaveText('Loaded: b.asm');
	await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
	await action('Edit').click();
	await action('a.asm').dragTo(source);
	await expect(source).toHaveValue('.text\nli $t0, 9\n');
	await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
	await action('a.asm').press('Alt+Shift+ArrowLeft');
	await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', 'a.asm', '* b.asm']);
});
