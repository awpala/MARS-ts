import { expect, test } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

test('theme toggle preserves editor and execution state, recolors panes, and persists both choices', async ({
	page
}) => {
	test.setTimeout(90_000);
	await openDesktop(page);
	const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
	await expect(toggle).toHaveAttribute('aria-checked', 'false');
	await expect(toggle.locator('.thumb')).toHaveCSS('transition-duration', '0.3s');
	await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(237, 237, 237)');
	await page.getByRole('button', { name: 'New', exact: true }).click();
	const source = page.getByRole('textbox', { name: 'Source mips1.asm', exact: true });
	const program = '.text\nli $t0, 42\nli $v0, 10\nsyscall\n';
	await source.fill(program);
	await toggle.focus();
	await toggle.press('Space');
	await expect(toggle).toHaveAttribute('aria-checked', 'true');
	await expect(toggle.locator('.thumb')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 28, 0)');
	await expect(page.locator('.source-surface')).toHaveCSS('background-color', 'rgb(22, 30, 39)');
	await expect(page.locator('.syntax-layer [data-token="6"]').first()).toHaveCSS(
		'color',
		'rgb(143, 199, 255)'
	);
	await expect(source).toHaveValue(program);
	await page.getByRole('button', { name: 'Assemble', exact: true }).click();
	const range = page.getByRole('combobox', { name: 'Data segment base' });
	await expect(range).toHaveCSS('background-color', 'rgb(45, 57, 72)');
	await expect(range.locator('option').first()).toHaveCSS('background-color', 'rgb(22, 30, 39)');
	await expect(range.locator('option').first()).toHaveCSS('color', 'rgb(225, 233, 242)');
	await range.selectOption('heap');
	await expect(range).toHaveValue('heap');
	await page.getByRole('button', { name: 'Step', exact: true }).click();
	const register = page.getByLabel('$t0 value', { exact: true });
	await expect(register).toHaveValue('0x0000002a');
	await expect(page.locator('.text-segment tr.current')).toHaveCSS(
		'background-color',
		'rgb(98, 81, 36)'
	);
	await toggle.click();
	await expect(range.locator('option').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(register).toHaveValue('0x0000002a');
	await expect(page.locator('.text-segment tr.current')).toHaveCSS(
		'background-color',
		'rgb(255, 255, 153)'
	);
	await toggle.click();
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(37, 47, 60)');
	await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
	await page.reload();
	await expect(toggle).toBeEnabled({ timeout: 30_000 });
	await expect(toggle).toHaveAttribute('aria-checked', 'true');
	await toggle.click();
	await page.reload();
	await expect(toggle).toBeEnabled({ timeout: 30_000 });
	await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('saved dark palette is applied before hydration', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('mars-ts:theme:v1', 'dark'));
	// Hold application modules to observe the initial document without hydration.
	await page.route('**/*', (route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue()
	);
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('.loading-screen')).toHaveCSS('background-color', 'rgb(32, 40, 51)');
});

test('invalid preferences and unavailable storage keep appearance usable', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		localStorage.setItem('mars-ts:theme:v1', 'invalid');
	});
	await openDesktop(page);
	const toggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
	await expect(toggle.locator('.thumb')).toHaveCSS('transition-duration', '0.3s');
	await expect(toggle).toHaveAttribute('aria-checked', 'false');
	await page.evaluate(() => {
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('Storage blocked', 'SecurityError');
			}
		});
	});
	await toggle.click();
	await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(32, 40, 51)');
	await toggle.click();
	await expect(page.locator('.desktop')).toHaveCSS('background-color', 'rgb(237, 237, 237)');
});

test('slider visibly travels in both directions even with reduced motion enabled', async ({
	page
}) => {
	await openDesktop(page);
	await expect(page.locator('.theme-control')).toContainText('Theme:');
	for (const reducedMotion of ['no-preference', 'reduce'] as const) {
		await page.emulateMedia({ reducedMotion });
		for (const destination of [28, 0]) {
			const positions = await page
				.getByRole('switch', { name: 'Dark theme' })
				.evaluate(async (element) => {
					const thumb = element.querySelector<HTMLElement>('.thumb')!;
					const positions: number[] = [];
					const readPosition = () => new DOMMatrixReadOnly(getComputedStyle(thumb).transform).m41;
					positions.push(readPosition());
					(element as HTMLButtonElement).click();
					const start = performance.now();
					await new Promise<void>((resolve) => {
						function sample() {
							positions.push(readPosition());
							if (performance.now() - start < 600) requestAnimationFrame(sample);
							else resolve();
						}
						requestAnimationFrame(sample);
					});
					return positions;
				});
			expect(positions[0]).toBe(28 - destination);
			expect(positions.some((position) => position > 1 && position < 27)).toBe(true);
			expect(positions.at(-1)).toBe(destination);
		}
	}
});
