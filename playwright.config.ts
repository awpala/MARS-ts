import { defineConfig } from '@playwright/test';

/** Browser tests exclusively own port 6278; port 6277 is exclusively for the human, and ad hoc agent servers use 6279 or higher. */
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './__build/browser-results',
  fullyParallel: true,
  // Full-desktop scenarios measure 25–35 s on a loaded dev container (cold dev-server compiles,
  // reloads, and parallel workers); 60 s keeps about twice that headroom.
  timeout: 60_000,
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
