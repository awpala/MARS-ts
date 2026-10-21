import { Globals } from '#lib/engine/Globals.js';
import { RunController } from '#lib/venus/RunController.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_SESSION_STORAGE_KEY,
  isDesktopSession,
  loadDesktopSession,
  saveDesktopSession,
  type DesktopSession
} from './DesktopSession.js';

function record(): DesktopSession {
  return {
    view: 'Edit',
    registerTab: 'Registers',
    messageTab: 'Mars Messages',
    source: 'main.asm',
    editHistory: [{ name: 'main.asm', text: 'invalid', undo: [''], redo: [] }],
    dataView: { segment: 'data', pageOffset: 0 },
    selection: [3, 3],
    scroll: [0, 0],
    breakpoints: [],
    breakpointsEnabled: true,
    messages: 'saved diagnostics',
    programArguments: 'one two',
    runIO: 'saved output',
    execution: null,
    unloadedError: true
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('desktop browser recovery storage', () => {
  it('round-trips editor history, independent consoles, view, and unloaded error state', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
    const saved = record();
    saveDesktopSession(saved);
    expect(loadDesktopSession()).toEqual(saved);
    expect(values.size).toBe(1);
    expect(values.has(DESKTOP_SESSION_STORAGE_KEY)).toBe(true);
  });

  it('rejects incompatible recovery and unsafe nested machine payloads without mutating storage', () => {
    const setItem = vi.fn();
    for (const raw of [
      '{',
      '{}',
      JSON.stringify({ ...record(), selection: [-1, 0] }),
      JSON.stringify({ ...record(), programArguments: 42 }),
      JSON.stringify({
        ...record(),
        editHistory: [{ name: 'main.asm', text: 'a', undo: [null], redo: [] }]
      }),
      JSON.stringify({
        ...record(),
        execution: { sources: { 'main.asm': '' }, machine: { status: 'running' } }
      })
    ]) {
      vi.stubGlobal('localStorage', { getItem: () => raw, setItem });
      expect(loadDesktopSession()).toBeUndefined();
    }
    expect(setItem).not.toHaveBeenCalled();
    expect(isDesktopSession({ ...record(), dataView: { segment: 'unknown', pageOffset: 0 } })).toBe(
      false
    );
  });

  it('reports failed writes and preserves the previous complete recovery record', () => {
    const previous = JSON.stringify(record());
    vi.stubGlobal('localStorage', {
      getItem: () => previous,
      setItem: () => {
        throw new Error('Quota exceeded');
      }
    });
    expect(() => saveDesktopSession({ ...record(), runIO: 'new output' })).toThrow(
      'Quota exceeded'
    );
    expect(loadDesktopSession()?.runIO).toBe('saved output');
  });

  it('remains importable without browser storage and uses normal initialization when access is blocked', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadDesktopSession()).toBeUndefined();
  });
});

it('validates optional program-owned label identities and preserves older checkpoints without a selection', async () => {
  const machine = new Globals({
    readSource: () => '.text\nnop\n',
    readInput: () => '',
    printString: () => {},
    yieldControl: async () => {},
    sourcePaths: {
      separator: '/',
      isAbsolute: (filename) => filename.startsWith('/'),
      getParent: () => ''
    }
  });
  const controller = new RunController(machine);
  try {
    controller.assemble(['main.asm'], 'main.asm');
    const execution = {
      machine: controller.captureCheckpoint()!,
      sources: { 'main.asm': '.text\nnop\n' }
    };
    expect(isDesktopSession({ ...record(), execution })).toBe(true);
    for (const labelSelection of [
      null,
      { filename: null, name: 'global', address: -2147483648 },
      { filename: 'main.asm', name: 'alias', address: 0x00400000 }
    ]) {
      expect(isDesktopSession({ ...record(), execution: { ...execution, labelSelection } })).toBe(
        true
      );
    }
    for (const labelSelection of [
      false,
      {},
      { filename: 1, name: 'label', address: 0 },
      { filename: null, name: '', address: 0 },
      { filename: 'main.asm', name: 'label', address: 0x90000000 },
      { filename: 'main.asm', name: 'label', address: 1.5 }
    ]) {
      expect(isDesktopSession({ ...record(), execution: { ...execution, labelSelection } })).toBe(
        false
      );
    }
  } finally {
    await controller.dispose();
  }
});
