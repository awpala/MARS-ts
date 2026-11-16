import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CooperativeScheduler } from './CooperativeScheduler.js';

class TestChannel {
  readonly messages: number[] = [];
  readonly port1 = {
    onmessage: null as ((event: { data: number }) => void) | null,
    close: vi.fn()
  };
  readonly port2 = {
    postMessage: (token: number) => this.messages.push(token),
    close: vi.fn()
  };
  deliver(): void {
    this.port1.onmessage?.({ data: this.messages.shift()! });
  }
}

let channel: TestChannel;
beforeEach(() => {
  vi.useFakeTimers();
  channel = new TestChannel();
  vi.stubGlobal(
    'MessageChannel',
    class {
      readonly port1 = channel.port1;
      readonly port2 = channel.port2;
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('yields zero-delay work to a message task rather than a timer or only a microtask', async () => {
  const scheduler = new CooperativeScheduler();
  const completed = vi.fn();
  const wait = scheduler.yieldControl(0).then(completed);
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  expect(channel.messages).toHaveLength(1);
  channel.deliver();
  await wait;
  expect(completed).toHaveBeenCalledOnce();
  scheduler.dispose();
});

it('keeps finite-speed delays on timers', async () => {
  const scheduler = new CooperativeScheduler();
  const completed = vi.fn();
  const wait = scheduler.yieldControl(125).then(completed);
  await vi.advanceTimersByTimeAsync(124);
  expect(completed).not.toHaveBeenCalled();
  expect(channel.messages).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  await wait;
  expect(completed).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  scheduler.dispose();
});

it('wakes all waits and ignores an old task when a later run is waiting', async () => {
  const scheduler = new CooperativeScheduler();
  const first = scheduler.yieldControl(0);
  const timed = scheduler.yieldControl(1000);
  scheduler.wake();
  await Promise.all([first, timed]);
  expect(vi.getTimerCount()).toBe(0);
  const completed = vi.fn();
  const later = scheduler.yieldControl(0).then(completed);
  channel.deliver();
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  channel.deliver();
  await later;
  expect(completed).toHaveBeenCalledOnce();
  scheduler.dispose();
});

it('disposes both ports and waits once, and never schedules after removal', async () => {
  const scheduler = new CooperativeScheduler();
  const pending = [scheduler.yieldControl(0), scheduler.yieldControl(1000)];
  scheduler.dispose();
  scheduler.dispose();
  await Promise.all(pending);
  expect(channel.port1.onmessage).toBeNull();
  expect(channel.port1.close).toHaveBeenCalledOnce();
  expect(channel.port2.close).toHaveBeenCalledOnce();
  await scheduler.yieldControl(0);
  await scheduler.yieldControl(1000);
  expect(channel.messages).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
