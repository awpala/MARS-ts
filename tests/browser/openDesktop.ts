import { expect, type Page } from '@playwright/test';

/** Wait for the desktop's actual hydration/session readiness before testing working controls. */
export async function openDesktop(page: Page): Promise<void> {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled({
		timeout: 30000
	});
}

/** Seed browser-local source records and open selected names (all by default) through the actual Open dialog. */
export async function openStoredSources(
	page: Page,
	sources: { name: string; source: string }[],
	selectedNames: string[] = sources.map((source) => source.name)
): Promise<void> {
	await page.evaluate(
		(records) => localStorage.setItem('mars-ts:sources:v1', JSON.stringify(records)),
		sources
	);
	await page.getByRole('button', { name: 'Open ...', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Open', exact: true });
	for (const name of selectedNames) {
		await dialog.getByRole('checkbox', { name, exact: true }).check();
	}
	await dialog.getByRole('button', { name: 'Open', exact: true }).click();
}
