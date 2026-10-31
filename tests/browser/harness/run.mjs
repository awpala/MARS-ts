import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
  writeSync
} from 'node:fs';
import { createServer } from 'node:net';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = resolve(root, 'node_modules/playwright/cli.js');
const args = process.argv.slice(2);
const runId = `${Math.floor(Date.now() / 1000)}-${process.pid}`;
const logs = resolve(root, '__logs/__test-runs');
mkdirSync(logs, { recursive: true });

if (args.some((arg) => ['--list', '--help', '-h', '--version'].includes(arg))) {
  const result = spawnSync(process.execPath, [cli, 'test', ...args], {
    cwd: root,
    stdio: 'inherit'
  });
  process.exit(result.status ?? 1);
}

// Collect only the requested cases, including --last-failed, before assigning independent runners.
const discovery = spawnSync(process.execPath, [cli, 'test', ...args, '--list', '--reporter=json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024
});
writeFileSync(
  resolve(logs, `${runId.replace('-', '_')}_browser-discovery.log`),
  discovery.stdout + discovery.stderr
);
if (discovery.status !== 0) {
  process.stderr.write(discovery.stdout + discovery.stderr);
  process.exit(discovery.status ?? 1);
}
const inventory = JSON.parse(discovery.stdout);
const groups = new Map();
const rootIds = new Map();
for (const file of inventory.suites) collect(file, []);
if (groups.size === 0) {
  console.log('No browser scenarios match the requested selection.');
  process.exit(0);
}

// Capture once so queued groups keep the same inputs while the working tree evolves.
const inputs = resolve(root, '__build/browser-runs', runId, 'inputs');
mkdirSync(inputs, { recursive: true });
for (const path of [
  'src',
  'static',
  'vite.config.ts',
  'tsconfig.json',
  'package.json',
  'playwright.config.ts',
  'tests/browser',
  '.gitignore'
]) {
  cpSync(resolve(root, path), resolve(inputs, path), { recursive: true });
}

const budget = Math.max(1, Math.floor(Math.min(4, availableParallelism()) / 2));
const concurrency = process.env.CI ? 1 : budget;
const children = new Set();
const ports = new Set();
let interrupted = false;
let failed = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    interrupted = true;
    for (const child of children) child.kill(signal);
  });
// Start the largest selections first so a large final group cannot leave one slot idle.
const pending = [...groups.entries()].sort((left, right) => right[1].length - left[1].length);
await Promise.all(
  Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (!interrupted && pending.length) {
      const [group, cases] = pending.shift();
      try {
        if ((await runGroup(group, cases)) !== 0) failed = true;
      } catch (error) {
        failed = true;
        console.error(`[${group}] runner failed:`, error);
      }
    }
  })
);
console.log(
  `Browser groups: ${interrupted ? 'interrupted' : failed ? 'failed' : 'passed'}; run ${runId}`
);
process.exitCode = interrupted ? 130 : failed ? 1 : 0;

function collect(suite, titles) {
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests) {
      const key = `${test.projectName} › ${spec.file} › ${[...titles, spec.title].join(' › ')}`;
      rootIds.set(key, spec.id);
      if (test.projectName === 'startup') continue;
      const cases = groups.get(test.projectName) ?? [];
      cases.push({
        id: spec.id,
        line: `[${test.projectName}] › ${spec.file} › ${[...titles, spec.title].join(' › ')}`
      });
      groups.set(test.projectName, cases);
    }
  for (const child of suite.suites ?? []) collect(child, [...titles, child.title]);
}

async function freePort() {
  for (let port = 6278; ; port++) {
    if (ports.has(port)) continue;
    const server = createServer();
    const free = await new Promise((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (free) {
      ports.add(port);
      return port;
    }
  }
}

async function runGroup(group, cases) {
  const directory = resolve(root, '__build/browser-runs', runId, group);
  const snapshot = resolve(directory, 'app');
  cpSync(inputs, snapshot, { recursive: true });
  symlinkSync(resolve(root, 'node_modules'), resolve(snapshot, 'node_modules'), 'dir');
  const list = resolve(directory, 'cases.txt');
  writeFileSync(list, [...new Set(cases.map((test) => test.line))].join('\n') + '\n');
  const port = await freePort();
  const logPath = resolve(logs, `${runId.replace('-', '_')}_browser-${group}-runner.log`);
  const log = openSync(logPath, 'wx');
  console.log(
    `[${group}] ${cases.length} cases; port ${port}; snapshot ${snapshot}; log ${logPath}`
  );
  // Selection is already frozen in cases.txt; retain execution/reporting flags only.
  const flags = args.filter(
    (arg, index) =>
      !arg.startsWith('--project=') &&
      arg !== '--project' &&
      args[index - 1] !== '--project' &&
      arg !== '--last-failed' &&
      (arg.startsWith('-') || args[index - 1]?.startsWith('-'))
  );
  const selection = [
    `--config=${resolve(snapshot, 'playwright.config.ts')}`,
    `--project=${group}`,
    `--test-list=${list}`
  ];
  const collected = spawnSync(
    process.execPath,
    [cli, 'test', ...selection, '--list', '--reporter=json'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  writeFileSync(
    resolve(logs, `${runId.replace('-', '_')}_browser-${group}-inventory.log`),
    collected.stdout + collected.stderr
  );
  if (collected.status !== 0) {
    closeSync(log);
    ports.delete(port);
    process.stderr.write(collected.stdout + collected.stderr);
    return collected.status ?? 1;
  }
  const ids = new Map();
  const mapIds = (suite, titles = []) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) {
        const key = `${test.projectName} › ${spec.file} › ${[...titles, spec.title].join(' › ')}`;
        ids.set(spec.id, rootIds.get(key));
      }
    for (const child of suite.suites ?? []) mapIds(child, [...titles, child.title]);
  };
  for (const suite of JSON.parse(collected.stdout).suites) mapIds(suite);
  const child = spawn(process.execPath, [cli, 'test', ...flags, ...selection], {
    cwd: root,
    env: {
      ...process.env,
      MARS_BROWSER_SNAPSHOT: snapshot,
      MARS_BROWSER_PORT: String(port),
      MARS_BROWSER_GROUP: group,
      MARS_BROWSER_RUN_ID: runId,
      MARS_BROWSER_WORKERS: String(process.env.CI ? budget : 1),
      MARS_BROWSER_LOG_DIR: logs,
      MARS_BROWSER_RESULTS: resolve(root, '__build/browser-results', runId, group),
      MARS_BROWSER_REPORT: resolve(root, '__build/browser-report', runId, group)
    },
    stdio: ['inherit', 'pipe', 'pipe']
  });
  children.add(child);
  child.stdout.on('data', (chunk) => {
    writeSync(log, chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    writeSync(log, chunk);
    process.stderr.write(chunk);
  });
  const status = await new Promise((resolve) => {
    child.once('error', (error) => {
      writeSync(log, String(error));
      resolve(1);
    });
    child.once('exit', (code) => resolve(code ?? 130));
  });
  children.delete(child);
  closeSync(log);
  ports.delete(port);
  console.log(`[${group}] exit ${status}; log ${logPath}`);
  // Keep the normal Playwright --last-failed selection available across group processes.
  const lastRun = resolve(root, '__build/browser-results', runId, group, '.last-run.json');
  if (existsSync(lastRun)) {
    const combined = resolve(root, '__build/browser-results/.last-run.json');
    const previous = existsSync(combined)
      ? JSON.parse(readFileSync(combined, 'utf8')).failedTests
      : [];
    const current = JSON.parse(readFileSync(lastRun, 'utf8'));
    const selectedIds = new Set(cases.map((test) => test.id));
    const failedTests = [
      ...new Set([
        ...previous.filter((id) => !selectedIds.has(id)),
        ...current.failedTests.map((id) => {
          const original = ids.get(id);
          if (!original) throw new Error(`Missing snapshot test identity for ${id}`);
          return original;
        })
      ])
    ];
    writeFileSync(
      combined,
      JSON.stringify({
        status: interrupted
          ? 'interrupted'
          : failed || status !== 0 || failedTests.length
            ? 'failed'
            : 'passed',
        failedTests
      })
    );
  }
  return status;
}
