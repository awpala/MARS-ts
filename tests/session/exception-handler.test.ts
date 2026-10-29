import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Globals } from '#lib/engine/Globals.js';
import { Settings } from '#lib/engine/Settings.js';
import { RunController } from '#lib/venus/RunController.js';
import { isRunCheckpoint } from '#lib/venus/RunCheckpoint.js';
import { buildFileNameList } from '#lib/venus/utils/execution/buildFileNameList.js';
import { SimulationState } from '#lib/venus/state/SimulationState.svelte.js';
import { SourceWorkspace } from '#lib/venus/state/SourceWorkspace.svelte.js';
import { DisplayPreferences } from '#lib/venus/state/DisplayPreferences.svelte.js';
import { spimExceptionHandler } from '#lib/browser/BundledSources.js';
import { parseTabRows, readOracleJson } from '../oracle/fixtures.js';

const fixture = readOracleJson<{ stdout: string; stderr: string; status: number }>(
  'exception-handler/golden.json'
);
const rows = parseTabRows(fixture.stdout);
const source = (name: string) =>
  readFileSync(new URL(`../oracle/exception-handler/sources/${name}`, import.meta.url), 'utf8');
const host = {
  readSource: () => '',
  sourcePaths: {
    separator: '/',
    isAbsolute: (name: string) => name.startsWith('/'),
    getParent: (name: string) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/')) : '')
  },
  readInput: () => '',
  printString: () => {},
  yieldControl: async () => {}
};

function session() {
  const files = new Map([
    ['lead.asm', source('lead.asm')],
    ['handler.asm', source('handler.asm')]
  ]);
  const globals = new Globals({
    ...host,
    readSource: (name) => {
      const key = name.replace(/^\//, '');
      if (!files.has(key)) throw new Error(`Missing virtual source: ${name}`);
      return files.get(key)!;
    }
  });
  const settings = globals.getSettings();
  settings.setExceptionHandler('handler.asm');
  settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, true);
  return { globals, settings, files, controller: new RunController(globals) };
}

function presentation() {
  const display = new DisplayPreferences();
  const workspace = new SourceWorkspace(display, {
    invalidate: () => {},
    report: () => {},
    running: () => false,
    assembleOnOpen: () => false,
    assemble: () => {}
  });
  return { workspace, simulation: new SimulationState(workspace, display) };
}

describe('automatic exception handlers', () => {
  it('assembles the bundled SPIM handler, keeps similarly named user includes separate, and returns from a trap', async () => {
    const { workspace } = presentation();
    workspace.editor.openFile('SPIM/exceptions.s', 'li $t1,7\n');
    workspace.refresh();
    const output: string[] = [];
    const globals = new Globals({
      ...host,
      readSource: (name) =>
        name === 'main.asm'
          ? '.globl main\n.text\nmain: teqi $zero,0\n.include "SPIM/exceptions.s"\nli $t0,42\nli $v0,10\nsyscall\n'
          : workspace.readSource(name),
      printString: (value) => output.push(value)
    });
    globals.getSettings().setExceptionHandler(spimExceptionHandler.name);
    globals.getSettings().setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, true);
    const controller = new RunController(globals);
    try {
      controller.assemble(['main.asm'], 'main.asm');
      await controller.run();
      expect(controller.getState().status).toBe('terminated');
      expect(output.join('')).toContain('[Trap]');
      expect(output.join('')).toContain('occurred and ignored');
      expect(globals.registerFile.getValue(8)).toBe(42);
      expect(globals.registerFile.getValue(9)).toBe(7);
      expect(globals.coprocessor0.getValue(13)).toBe(0);
    } finally {
      workspace.dispose();
      await controller.dispose();
    }
  });

  it('opens a single protected reference without invalidating assembly and copies exact licensed text', async () => {
    const { workspace } = presentation();
    try {
      // A writable relative path cannot replace the reserved bundled identity.
      workspace.editor.openFile('SPIM/exceptions.s', 'user source');
      workspace.refresh();
      expect(workspace.readSource('SPIM/exceptions.s')).toBe('user source');
      expect(workspace.readSource('/SPIM/exceptions.s')).toBe('user source');
      expect(workspace.readSource(spimExceptionHandler.name)).toBe(spimExceptionHandler.source);
      await workspace.openBundledSource(spimExceptionHandler.name);
      await workspace.openBundledSource(spimExceptionHandler.name);
      expect(workspace.tabs).toHaveLength(2);
      expect(workspace.current?.readOnly).toBe(true);
      workspace.edit('changed');
      await workspace.execute('saveAs');
      workspace.rename(workspace.current!.id, 'overwritten.s');
      expect(workspace.modal).toBeNull();
      expect(workspace.current?.text).toBe(spimExceptionHandler.source);
      expect(workspace.current?.name).toBe(spimExceptionHandler.name);
      expect(workspace.unsavedNames).toEqual([]);
      await workspace.copyToNewFile();
      expect(workspace.current?.readOnly).not.toBe(true);
      expect(workspace.current?.text).toBe(spimExceptionHandler.source);
      workspace.edit('# custom handler');
      expect(workspace.readSource(spimExceptionHandler.name)).toBe(spimExceptionHandler.source);
    } finally {
      workspace.dispose();
    }
  });

  it('matches the legacy filename-list wrapping and newline bytes', () => {
    expect(fixture.status).toBe(0);
    expect(fixture.stderr).toBe('');
    for (const [, names, output] of rows.filter(([kind]) => kind === 'message')) {
      expect(buildFileNameList('Assemble: assembling ', names ? names.split(',') : [])).toBe(
        Buffer.from(output, 'base64').toString('utf8')
      );
    }
  });

  it('matches captured toggle notifications and enabled handler commits', () => {
    const { workspace, simulation } = presentation();
    for (const [
      ,
      initial,
      enabled,
      name,
      expectedEnabled,
      expectedName,
      expectedNotices
    ] of rows.filter(
      ([kind, , enabled, name]) => kind === 'commit' && (enabled === 'true' || name === 'old.asm')
    )) {
      const writes: string[] = [];
      const machine = new Globals({
        ...host,
        preferences: {
          writePreference: (key) => {
            writes.push(key);
          }
        }
      });
      const settings = machine.getSettings();
      settings.setExceptionHandler('old.asm');
      settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, initial === 'true');
      writes.length = 0;
      let notices = 0;
      const release = settings.subscribe(() => {
        notices++;
      });
      simulation.machine = machine;
      simulation.updateExceptionHandler(enabled === 'true', name);
      expect(settings.getExceptionHandlerEnabled()).toBe(expectedEnabled === 'true');
      expect(settings.getExceptionHandler()).toBe(expectedName);
      expect(notices).toBe(Number(expectedNotices));
      if (initial === enabled && name === 'old.asm') expect(writes).toEqual([]);
      release();
    }
    workspace.dispose();
  });

  it('persists the selected handler independently of enablement and restores it while disabled', () => {
    const { workspace, simulation } = presentation();
    const saved = new Map<string, string>();
    const preferences = {
      readPreference: (key: string) => saved.get(key) ?? null,
      writePreference: (key: string, value: string) => {
        saved.set(key, value);
      }
    };
    simulation.machine = new Globals({ ...host, preferences });
    const settings = simulation.machine.getSettings();
    simulation.updateExceptionHandler(false, 'handler.asm');
    expect(settings.getExceptionHandlerEnabled()).toBe(false);
    expect(settings.getExceptionHandler()).toBe('handler.asm');
    simulation.updateExceptionHandler(true, 'handler.asm');
    expect(settings.getExceptionHandlerEnabled()).toBe(true);
    simulation.updateExceptionHandler(false, 'handler.asm');
    expect(settings.getExceptionHandler()).toBe('handler.asm');
    simulation.updateExceptionHandler(false, 'other.asm');
    const restored = new Globals({ ...host, preferences }).getSettings();
    expect(restored.getExceptionHandlerEnabled()).toBe(false);
    expect(restored.getExceptionHandler()).toBe('other.asm');
    workspace.dispose();
  });

  it('loads kernel text first, reaches the handler, returns through eret, backsteps, and resets retained sources', async () => {
    const { globals, controller, files } = session();
    const names: string[][] = [];
    controller.assemble(['lead.asm'], 'lead.asm', (files) => names.push([...files]));
    expect(names).toEqual([['handler.asm', 'lead.asm']]);
    expect(controller.getState().programs.map((program) => program.getFilename())).toEqual(
      names[0]
    );
    expect(
      globals.memory.getStatementNoNotify(globals.memory.exceptionHandlerAddress)
    ).not.toBeNull();
    await controller.step();
    expect(globals.registerFile.getProgramCounter()).toBe(globals.memory.exceptionHandlerAddress);
    controller.backStep();
    expect(globals.registerFile.getProgramCounter()).toBe(globals.memory.textBaseAddress);
    await controller.run();
    const expected = rows
      .find(([kind]) => kind === 'execution')!
      .slice(1)
      .map(Number);
    expect([
      globals.registerFile.getValue(8),
      globals.registerFile.getValue(9),
      globals.coprocessor0.getValue(12),
      globals.coprocessor0.getValue(13),
      globals.coprocessor0.getValue(14)
    ]).toEqual(expected);
    files.set('handler.asm', '.ktext 0x80000180\naddiu $t0,$zero,99\n');
    controller.reset();
    await controller.run();
    expect(globals.registerFile.getValue(8)).toBe(expected[0]);
    await controller.dispose();
  });

  it('replays the loaded handler after its future-assembly preference changes', async () => {
    for (const handler of [null, 'other.asm']) {
      const original = session();
      original.controller.assemble(['lead.asm'], 'lead.asm');
      await original.controller.step();
      original.settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, handler !== null);
      if (handler !== null) original.settings.setExceptionHandler(handler);
      const checkpoint = original.controller.captureCheckpoint()!;
      const restored = session();
      restored.controller.restoreCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
      expect(restored.controller.captureCheckpoint()).toEqual(checkpoint);
      expect(restored.settings.getExceptionHandlerEnabled()).toBe(handler !== null);
      expect(restored.controller.getState().programs[0].getFilename()).toBe('handler.asm');
      await restored.controller.run();
      expect(restored.globals.registerFile.getValue(8)).toBe(42);
      restored.controller.reset();
      await restored.controller.run();
      expect(restored.globals.registerFile.getValue(9)).toBe(7);
      await Promise.all([original.controller.dispose(), restored.controller.dispose()]);
    }
  });

  it('preserves a build without a handler when a future handler is selected', async () => {
    const original = session();
    original.settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, false);
    original.files.set('lead.asm', 'nop\n');
    original.controller.assemble(['lead.asm'], 'lead.asm');
    original.settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, true);
    const restored = session();
    restored.files.set('lead.asm', 'nop\n');
    restored.controller.restoreCheckpoint(original.controller.captureCheckpoint()!);
    expect(restored.controller.getState().programs).toHaveLength(1);
    expect(restored.settings.getExceptionHandlerEnabled()).toBe(true);
    await Promise.all([original.controller.dispose(), restored.controller.dispose()]);
  });

  it('ignores empty or disabled selections, and reports preparation failures before the preamble', async () => {
    const { settings, files, controller } = session();
    files.set('lead.asm', 'nop\n');
    settings.setExceptionHandler('');
    controller.assemble(['lead.asm'], 'lead.asm');
    expect(controller.getState().programs).toHaveLength(1);
    settings.setExceptionHandler('missing.asm');
    settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, false);
    controller.assemble(['lead.asm'], 'lead.asm');
    expect(controller.getState().programs).toHaveLength(1);
    settings.setBooleanSetting(Settings.EXCEPTION_HANDLER_ENABLED, true);
    const prepared: string[][] = [];
    expect(() =>
      controller.assemble(['lead.asm'], 'lead.asm', (files) => prepared.push([...files]))
    ).toThrow();
    expect(prepared).toEqual([]);
    expect(controller.getState().status).toBe('error');
    await controller.dispose();
  });

  it('keeps legacy duplicate-label errors when the program also includes its handler', async () => {
    const { files, controller } = session();
    files.set('handler.asm', '.ktext 0x80000180\n.globl handler\nhandler: nop\n');
    files.set('lead.asm', '.include "handler.asm"\n.text\nnop\n');
    expect(() => controller.assemble(['lead.asm'], 'lead.asm')).toThrow();
    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error?.errors()?.generateErrorReport()).toContain(
      'already defined'
    );
    await controller.dispose();
  });
  it('accepts handler sources without kernel text and restores older checkpoints using saved preferences', async () => {
    const original = session();
    original.files.set('lead.asm', 'nop\n');
    original.files.set('handler.asm', 'nop\n');
    original.controller.assemble(['lead.asm'], 'lead.asm');
    expect(original.controller.getState().programs).toHaveLength(2);
    const checkpoint = original.controller.captureCheckpoint()!;
    delete checkpoint.assemblyExceptionHandler;
    const restored = session();
    restored.files.set('lead.asm', 'nop\n');
    restored.files.set('handler.asm', 'nop\n');
    expect(isRunCheckpoint({ ...checkpoint, assemblyExceptionHandler: 42 })).toBe(false);
    restored.controller.restoreCheckpoint(checkpoint);
    expect(restored.controller.getState().programs).toHaveLength(2);
    await Promise.all([original.controller.dispose(), restored.controller.dispose()]);
  });
});
