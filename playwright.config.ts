import { defineConfig, type ReporterDescription } from '@playwright/test';
import { availableParallelism } from 'node:os';
import { browserSuites } from './tests/browser/harness/suites.js';

const snapshot = process.env.MARS_BROWSER_SNAPSHOT;
const port = Number(process.env.MARS_BROWSER_PORT ?? 6278);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

const reporters: ReporterDescription[] = process.env.CI
  ? [
      ['github'],
      [
        'html',
        { outputFolder: process.env.MARS_BROWSER_REPORT ?? '__build/browser-report', open: 'never' }
      ]
    ]
  : [['list']];
reporters.push(['./tests/browser/harness/SuiteLogReporter.ts']);

/** Independent browser groups use harness-allocated ports from 6278 upward; port 6277 belongs exclusively to the human. */
export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.MARS_BROWSER_RESULTS ?? './__build/browser-results',
  // Parallelize semantic groups and files; preserve each file's scenario order.
  fullyParallel: false,
  reporter: reporters,
  // Budget against a four-CPU machine: browser renderers, drivers, and Vite all need CPU.
  // Two concurrent scenarios avoid the reload contention measured with four workers.
  workers: Number(
    process.env.MARS_BROWSER_WORKERS ??
      Math.max(1, Math.floor(Math.min(4, availableParallelism()) / 2))
  ),
  // Keep the existing bound. Investigate timeout traces rather than extending it to hide
  // locator drift, incomplete readiness, rendering churn, or harness contention.
  timeout: 60_000,
  // The server's HTTP response precedes client-module compilation and hydration. Verify one
  // real desktop before parallel pages compete for the cold graph; setup uses the same deadlines.
  projects: [
    { name: 'startup', testMatch: '**/harness/desktop.setup.ts' },
    ...browserSuites().map((name) => ({
      name,
      testDir: `./tests/browser/${name}`,
      testMatch: '**/*.spec.ts',
      dependencies: ['startup'],
      // Local workers serve different groups; an isolated CI group can parallelize its files.
      workers: process.env.CI ? undefined : 1
    }))
  ],
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${port}`,
    // Offline behavior needs a production build. Dev-worker precaching competes with module loading
    // and cached responses can bypass the request replacements these integration scenarios install.
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: snapshot
      ? `node ${quote(`${process.cwd()}/node_modules/vite/bin/vite.js`)} ${quote(snapshot)} --mode browser-test --port ${port}`
      : 'npm run dev -- --mode browser-test',
    url: `http://127.0.0.1:${port}`,
    // Preserve Vite invalidation/reload messages in the invocation and infrastructure logs.
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: false
  }
});
