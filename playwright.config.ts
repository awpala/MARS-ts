import { defineConfig } from '@playwright/test';

/** Browser tests exclusively own port 6278; port 6277 remains available for human review. */
export default defineConfig({
	testDir: './tests/browser',
	outputDir: './__build/browser-results',
	fullyParallel: true,
	use: {
		baseURL: 'http://127.0.0.1:6278',
		viewport: { width: 1280, height: 900 },
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'npm run dev -- --mode browser-test',
		url: 'http://127.0.0.1:6278',
		reuseExistingServer: false
	}
});
