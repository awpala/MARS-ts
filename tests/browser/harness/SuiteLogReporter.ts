import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult
} from '@playwright/test/reporter';

/** Write live per-project evidence without changing scenario execution or replacing console reports. */
export default class SuiteLogReporter implements Reporter {
  private readonly directory = process.env.MARS_BROWSER_LOG_DIR
    ? pathToFileURL(`${process.env.MARS_BROWSER_LOG_DIR}/`)
    : new URL('../../../__logs/__test-runs/', import.meta.url);
  private readonly prefix = `${Math.floor(Date.now() / 1000)}`;
  private readonly files = new Map<string, URL>();
  private readonly tests = new Map<string, TestCase[]>();
  private readonly results = new Map<string, TestResult['status']>();
  private readonly listing = process.argv.includes('--list');
  private loggingFailed = false;

  /** Allocate project logs for the selected scenarios, excluding inventory-only invocations. */
  onBegin(_config: FullConfig, suite: Suite): void {
    if (this.listing) return;
    for (const test of suite.allTests()) {
      const project = this.project(test);
      const tests = this.tests.get(project) ?? [];
      tests.push(test);
      this.tests.set(project, tests);
    }
    for (const [project, tests] of this.tests) {
      this.append(project, `Selected ${tests.length} tests\n`);
    }
  }

  /** Record a start immediately so a stalled case remains identifiable in its group log. */
  onTestBegin(test: TestCase, result: TestResult): void {
    this.append(
      this.project(test),
      `START ${test.titlePath().join(' › ')} (retry ${result.retry})\n`
    );
  }

  /** Record the actual outcome and complete failure details without suppressing failures. */
  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.set(test.id, result.status);
    this.append(
      this.project(test),
      `${result.status.toUpperCase()} ${test.titlePath().join(' › ')} (${result.duration}ms)\n` +
        result.errors.map((error) => `${this.errorText(error)}\n`).join('')
    );
  }

  /** Preserve worker stdout in its project log, or the infrastructure log when unattributed. */
  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    this.append(test ? this.project(test) : 'infrastructure', chunk.toString());
  }

  /** Preserve worker stderr alongside its project events. */
  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    this.append(test ? this.project(test) : 'infrastructure', chunk.toString());
  }

  /** Preserve failures outside a scenario, including discovery and worker errors. */
  onError(error: TestError): void {
    this.append('infrastructure', `ERROR ${this.errorText(error)}\n`);
  }

  /** Summarize completed and unrun cases; a log-write failure also fails validation. */
  async onEnd(result: FullResult): Promise<{ status: 'failed' } | void> {
    if (this.listing) return;
    for (const [project, tests] of this.tests) {
      const counts: Record<string, number> = {};
      for (const test of tests) {
        const status = this.results.get(test.id) ?? 'notRun';
        counts[status] = (counts[status] ?? 0) + 1;
      }
      this.append(project, `SUMMARY ${JSON.stringify(counts)}; overall run ${result.status}\n`);
    }
    this.append('infrastructure', `Run ${result.status}; duration ${result.duration}ms\n`);
    if (this.loggingFailed) return { status: 'failed' };
  }

  /** Keep Playwright's ordinary terminal reporting enabled alongside these files. */
  printsToStdio(): boolean {
    return false;
  }

  private project(test: TestCase): string {
    return test.parent.project()?.name ?? 'infrastructure';
  }

  private errorText(error: TestError): string {
    return error.stack ?? error.message ?? error.value ?? 'Unknown Playwright error';
  }

  private append(project: string, content: string): void {
    if (this.listing || this.loggingFailed) return;
    try {
      let file = this.files.get(project);
      if (!file) {
        mkdirSync(this.directory, { recursive: true });
        file = new URL(`${this.prefix}_browser-${project}-${process.pid}.log`, this.directory);
        writeFileSync(file, `Browser project: ${project}\nStarted: ${new Date().toISOString()}\n`, {
          flag: 'wx'
        });
        this.files.set(project, file);
        process.stdout.write(`Project log: ${fileURLToPath(file)}\n`);
      }
      appendFileSync(file, content);
    } catch (error) {
      this.loggingFailed = true;
      process.stderr.write(`Browser project logging failed: ${String(error)}\n`);
    }
  }
}
