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
