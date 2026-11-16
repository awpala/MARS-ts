import { expect, test, type Page } from '@playwright/test';
import { waitForDesktop } from '../harness/openDesktop.js';

type ObservationWindow = Window &
  typeof globalThis & {
    /** Test-owned counts from public hardware subscription boundaries. */
    observation: {
      registers: number;
      memory: { low: number; high: number }[];
      labelReads: number;
    };
    /** Teardown of the production desktop mounted by this test. */
    releaseDesktop: () => Promise<void>;
  };

async function openObservedDesktop(page: Page): Promise<void> {
  await page.route('**/observation-test', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
  );
  await page.goto('/observation-test');
  await page.evaluate(async () => {
    const registerPath = '/src/lib/engine/hardware/registers/Register.ts';
    const memoryPath = '/src/lib/engine/hardware/memory/Memory.ts';
    const symbolPath = '/src/lib/engine/assembler/symbols/SymbolTable.ts';
    const desktopPath = '/src/lib/venus/mountDesktop.browser-test.ts';
    const { Register } = (await import(
      /* @vite-ignore */ registerPath
    )) as typeof import('../../../src/lib/engine/hardware/registers/Register.js');
    const { Memory } = (await import(
      /* @vite-ignore */ memoryPath
    )) as typeof import('../../../src/lib/engine/hardware/memory/Memory.js');
    const { SymbolTable } = (await import(
      /* @vite-ignore */ symbolPath
    )) as typeof import('../../../src/lib/engine/assembler/symbols/SymbolTable.js');
    const { mountDesktop } = (await import(
      /* @vite-ignore */ desktopPath
    )) as typeof import('../../../src/lib/venus/mountDesktop.browser-test.js');
    const target = window as ObservationWindow;
    const observation: ObservationWindow['observation'] = {
      registers: 0,
      memory: [],
      labelReads: 0
    };
    target.observation = observation;
    const subscribe = Register.prototype.subscribe;
    Register.prototype.subscribe = function (observer) {
      observation.registers++;
      const release = subscribe.call(this, observer);
      let active = true;
      return () => {
        if (active) observation.registers--;
        active = false;
        release();
      };
    };
    const addObserver = Memory.prototype.addObserver;
    Memory.prototype.addObserver = function (observer, low, high) {
      const release = addObserver.call(this, observer, low, high);
      // The no-range overload delegates to two concrete ranges; count each real registration once.
      if (low === undefined) return release;
      const range = { low, high: high ?? low };
      observation.memory.push(range);
      return () => {
        const index = observation.memory.indexOf(range);
        if (index !== -1) observation.memory.splice(index, 1);
        release();
      };
    };
    const getAllSymbols = SymbolTable.prototype.getAllSymbols;
    SymbolTable.prototype.getAllSymbols = function () {
      observation.labelReads++;
      return getAllSymbols.call(this);
    };
    target.releaseDesktop = mountDesktop(document.body);
  });
  await waitForDesktop(page);
}

const observation = (page: Page) => page.evaluate(() => (window as ObservationWindow).observation);

test('maximum Go releases debugger observers and pause, Step, Backstep, and timed Go restore them', async ({
  page
}) => {
  await openObservedDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: /^Source / }).fill(`.data
value: .word 0
.text
addiu $t0,$zero,1
lui $t1,0x1001
loop: sw $t0,0($t1)
addiu $t0,$t0,1
b loop
`);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  const initial = await observation(page);
  expect(initial.registers).toBeGreaterThan(0);
  expect(initial.memory).toHaveLength(2);
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await expect.poll(() => observation(page)).toEqual({ ...initial, registers: 0, memory: [] });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: paused');
  expect(await observation(page)).toEqual(initial);

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  const reset = await observation(page);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000001');
  await expect(
    page.getByTestId('register-row').filter({ has: page.getByLabel('$t0 value', { exact: true }) })
  ).toHaveAttribute('data-highlight', 'register');
  expect(await observation(page)).toEqual(reset);
  await page.getByRole('button', { name: 'Backstep', exact: true }).click();
  await expect(page.getByLabel('$t0 value', { exact: true })).toHaveValue('0x00000000');
  expect(await observation(page)).toEqual(reset);
  await page.getByRole('button', { name: 'Decrease run speed', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByLabel('$t0 value', { exact: true })).not.toHaveValue('0x00000000');
  expect(await observation(page)).toEqual(reset);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: terminated');
  expect(await observation(page)).toEqual(reset);
  await page.evaluate(() => (window as ObservationWindow).releaseDesktop());
  expect(await observation(page)).toEqual({ ...reset, registers: 0, memory: [] });
});

test('maximum Go retains only text observers for self-modifying code', async ({ page }) => {
  await openObservedDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: /^Source / }).fill(`.text
la $t0,target
sw $zero,0($t0)
loop: b loop
target: addiu $t1,$zero,7
`);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByLabel('Self-modifying code', { exact: true }).check();
  await page.getByTestId('menu-settings-trigger').click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByLabel('Execution status')).toHaveText('Status: running');
  await expect(page.getByLabel('Data segment base', { exact: true })).toHaveValue('text');
  await expect(page.getByLabel('Memory 0x00400010', { exact: true })).toHaveValue('0x00000000');
  const running = await observation(page);
  expect(running.registers).toBe(0);
  expect(running.memory).toEqual([
    { low: 0x00400000, high: 0x007ffffc },
    { low: 0x80000000 | 0, high: 0x803ffffc | 0 }
  ]);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByLabel('Code 0x00400010', { exact: true })).toHaveValue('0x00000000');
  await page.evaluate(() => (window as ObservationWindow).releaseDesktop());
  expect((await observation(page)).memory).toHaveLength(0);
});
