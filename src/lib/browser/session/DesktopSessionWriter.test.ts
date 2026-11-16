import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DesktopSessionWriter } from './DesktopSessionWriter.js';
import {
  DESKTOP_SESSION_STORAGE_KEY,
  isDesktopSession,
  type DesktopSession
} from './DesktopSession.js';

function record(): DesktopSession {
  return {
    view: 'Edit',
    registerTab: 'Registers',
    messageTab: 'Mars Messages',
    source: 'main.asm',
    editHistory: [{ name: 'main.asm', text: 'nop', undo: ['', 'n', 'no'], redo: [] }],
    dataView: { segment: 'data', pageOffset: 0 },
    selection: [0, 0],
    scroll: [0, 0],
    breakpoints: [],
    breakpointsEnabled: true,
    messages: '',
    runIO: '',
    execution: null,
    unloadedError: false
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('coalesces continuous presentation updates without postponing recovery indefinitely', () => {
  const setItem = vi.fn();
  const report = vi.fn();
  const writer = new DesktopSessionWriter(report, () => ({ setItem }));
  const session = record();
  for (let i = 0; i < 10; i++) {
    writer.schedule({ ...session, selection: [i, i] });
    vi.advanceTimersByTime(50);
  }
  expect(setItem).toHaveBeenCalledTimes(2);
  writer.dispose();
  expect(setItem).toHaveBeenCalledTimes(3);
  expect(setItem.mock.lastCall?.[0]).toBe(DESKTOP_SESSION_STORAGE_KEY);
  const saved = JSON.parse(setItem.mock.lastCall![1]);
  expect(saved).toEqual({ ...session, selection: [9, 9] });
  expect(isDesktopSession(saved)).toBe(true);
  expect(report).toHaveBeenLastCalledWith();
  expect(vi.getTimerCount()).toBe(0);
  writer.schedule(session);
  vi.runAllTimers();
  expect(setItem).toHaveBeenCalledTimes(3);
});

it('reuses unchanged detached history and replaces it when the editor publishes a new snapshot', () => {
  const session = record();
  const text = vi.fn(() => 'nop');
  Object.defineProperty(session.editHistory[0], 'text', { get: text, enumerable: true });
  const setItem = vi.fn();
  const writer = new DesktopSessionWriter(
    () => {},
    () => ({ setItem })
  );
  writer.schedule(session);
  writer.flush();
  expect(text).toHaveBeenCalled();
  text.mockClear();
  writer.schedule({ ...session, scroll: [100, 0] });
  writer.flush();
  expect(text).not.toHaveBeenCalled();
  const editHistory = [
    { name: 'main.asm', text: 'nop\nnop', undo: ['', 'n', 'no', 'nop'], redo: [] }
  ];
  writer.schedule({ ...session, editHistory });
  writer.dispose();
  expect(JSON.parse(setItem.mock.lastCall![1]).editHistory).toEqual(editHistory);
});

it('preserves the previous complete record on failure and accepts a later successful retry', () => {
  let saved = '';
  let fail = false;
  const report = vi.fn();
  const writer = new DesktopSessionWriter(report, () => ({
    setItem: (_key, value) => {
      if (fail) throw new Error('Quota exceeded');
      saved = value;
    }
  }));
  const session = record();
  writer.schedule(session);
  writer.flush();
  const previous = saved;
  fail = true;
  writer.schedule({ ...session, messages: 'new' });
  writer.flush();
  expect(saved).toBe(previous);
  expect(report).toHaveBeenLastCalledWith(new Error('Quota exceeded'));
  fail = false;
  writer.schedule({ ...session, selection: [-1, 0] });
  writer.flush();
  expect(saved).toBe(previous);
  expect(report).toHaveBeenLastCalledWith(new TypeError('Invalid desktop recovery state'));
  writer.schedule({ ...session, messages: 'new' });
  writer.dispose();
  expect(JSON.parse(saved).messages).toBe('new');
});
