import { expect, type Page } from '@playwright/test';

/** Wait for the desktop's actual hydration/session readiness before testing working controls. */
export async function openDesktop(page: Page): Promise<void> {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'New', exact: true })).toBeEnabled({
		timeout: 30000
	});
}
