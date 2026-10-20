import { expect, test } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

test('repository link opens a new tab and releases mouse tooltip while preserving keyboard help', async ({
	page,
	context
}) => {
	await context.route('https://github.com/awpala/MARS-ts', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<title>Repository</title>' })
	);
	await openDesktop(page);
	const link = page.getByRole('link', { name: 'MARS-ts on GitHub (opens in a new tab)' });
	const theme = page.getByRole('switch', { name: 'Dark theme' });
	const tooltip = page.locator('.tooltip');
	const themeBounds = (await theme.boundingBox())!;
	const linkBounds = (await link.boundingBox())!;
	expect(linkBounds.x).toBeGreaterThan(themeBounds.x + themeBounds.width);
	await link.hover();
	await expect(tooltip).toBeVisible();
	const opened = page.waitForEvent('popup');
	await link.click();
	const repository = await opened;
	await expect(repository).toHaveURL('https://github.com/awpala/MARS-ts');
	await repository.close();
	await page.bringToFront();
	await page.mouse.move(5, 200);
	await expect(tooltip).toBeHidden();
	await theme.focus();
	await theme.press('Tab');
	await expect(link).toBeFocused();
	await expect(link).toHaveAccessibleDescription('MARS-ts on GitHub (opens in a new tab)');
	await page.keyboard.press('Escape');
	await expect(tooltip).toBeHidden();
});

test('tooltips support disabled controls, hover, focus, dismissal, themes, and keycaps', async ({
	page
}) => {
	await openDesktop(page);
	const tooltip = page.locator('.tooltip');
	const step = page.getByRole('button', { name: 'Step', exact: true });
	await expect(step).toBeDisabled();
	await step.hover();
	await expect(tooltip).toBeVisible();
	await expect(step).toHaveAccessibleDescription('Step F7');
	await expect(step).not.toHaveAttribute('title');
	await tooltip.hover();
	await expect(tooltip).toBeVisible();
	await page.mouse.move(5, 200);
	await expect(tooltip).toBeHidden();

	const create = page.getByRole('button', { name: 'New', exact: true });
	await create.focus();
	await expect(create).toHaveAccessibleDescription('New Alt+N / Option+N');
	await page.keyboard.press('Escape');
	await expect(tooltip).toBeHidden();
	await expect(create).toBeFocused();

	await page
		.locator('.menubar summary')
		.filter({ hasText: /^File$/ })
		.click();
	const save = page
		.locator('details[open]')
		.getByRole('button', { name: 'Save Ctrl+S', exact: true });
	await expect(save.locator('kbd')).toHaveText(['Ctrl', 'S']);
	await page.keyboard.press('Escape');
	await page.getByRole('switch', { name: 'Dark theme' }).click();
	await create.hover();
	await expect(tooltip).toHaveCSS('background-color', 'rgb(52, 59, 50)');
	await expect(tooltip.locator('kbd').first()).toHaveCSS('background-color', 'rgb(22, 30, 39)');

	await page.setViewportSize({ width: 800, height: 600 });
	const theme = page.getByRole('switch', { name: 'Dark theme' });
	await theme.hover();
	await expect(tooltip).toBeVisible();
	const bounds = (await tooltip.boundingBox())!;
	expect(bounds.x).toBeGreaterThanOrEqual(8);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(792);
	expect(bounds.y + bounds.height).toBeLessThanOrEqual(592);
	await page.screenshot({ path: '__build/venus-tooltip-dark.png' });
});

test('keyboard commands share breakpoint policy and leave text inputs and dialogs alone', async ({
	page
}) => {
	await openDesktop(page);
	await page.keyboard.press('Alt+n');
	const source = page.getByRole('textbox', { name: /^Source / });
	await source.fill('.text\nloop: addiu $t0,$t0,1\nb loop\n');
	await source.press('F3');
	const breakpoint = page.getByLabel('Breakpoint 0x00400004', { exact: true });
	const toggle = page.getByRole('button', { name: 'Toggle all breakpoints', exact: true });
	const clear = page.getByRole('button', { name: 'Clear all breakpoints', exact: true });
	await breakpoint.check();
	await breakpoint.press('Control+t');
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await expect(breakpoint).toBeChecked();
	await toggle.press('Meta+t');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await toggle.press('Control+Shift+t');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');

	await page.getByLabel('$t0 value', { exact: true }).press('Control+k');
	await expect(breakpoint).toBeChecked();
	await page.getByRole('button', { name: 'Help', exact: true }).click();
	await page.keyboard.press('Control+k');
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(breakpoint).toBeChecked();
	await page.keyboard.press('Escape');
	await toggle.press('Control+t');
	await page.getByRole('button', { name: 'Go', exact: true }).click();
	await expect(toggle).toBeDisabled();
	await page.keyboard.press('Control+k');
	await expect(breakpoint).toBeChecked();
	await page.getByRole('button', { name: 'Stop', exact: true }).click();
	await expect(clear).toBeEnabled();
	await clear.press('Control+k');
	await expect(breakpoint).not.toBeChecked();
	await expect(clear).toBeDisabled();
});
