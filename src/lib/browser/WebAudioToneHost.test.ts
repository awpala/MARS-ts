import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tone } from '#lib/engine/syscalls/midi/Tone.js';
import { WebAudioToneHost, type ToneContext } from './WebAudioToneHost.js';

class FakeParam {
  value = 0;
  events: [string, ...number[]][] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push(['ramp', value, time]);
  }
  cancelScheduledValues(time: number) {
    this.events.push(['cancel', time]);
  }
  setTargetAtTime(value: number, time: number, constant: number) {
    this.events.push(['target', value, time, constant]);
  }
}
class FakeGain {
  gain = new FakeParam();
  connect<T>(node: T) {
    return node;
  }
  disconnect() {}
}
class FakeOscillator extends FakeGain {
  type = '';
  frequency = new FakeParam();
  started: number | undefined;
  stopped: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(time: number) {
    this.started = time;
  }
  stop(time?: number) {
    this.stopped.push(time);
  }
}
class FakeContext {
  currentTime = 10;
  state: AudioContextState = 'running';
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
}
const tone = (overrides: Partial<Tone> = {}): Tone => ({
  pitch: 69,
  duration: 500,
  instrument: 0,
  volume: 127,
  ...overrides
});
function setup(context: FakeContext | undefined = new FakeContext()) {
  const factory = vi.fn(() => context as unknown as ToneContext | undefined);
  return { context: context!, factory, host: new WebAudioToneHost(factory) };
}
function track(promise: Promise<void>) {
  const state = { settled: false };
  void promise.then(() => (state.settled = true));
  return state;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Web Audio tone host', () => {
  it('sounds an equal-tempered sine with square-law velocity gain and a clickless envelope', () => {
    const { context, host } = setup();
    void host.playTone(tone());
    void host.playTone(tone({ pitch: 60, volume: 64, instrument: 40 }));
    const [a, b] = context.oscillators;
    expect(a.type).toBe('sine');
    expect(a.frequency.value).toBe(440);
    expect(b.frequency.value).toBeCloseTo(261.6255653, 6);
    expect(a.started).toBe(10);
    expect(a.stopped).toEqual([10.5 + WebAudioToneHost.RELEASE]);
    expect(context.gains[0].gain.events).toEqual([
      ['set', 0, 10],
      ['ramp', WebAudioToneHost.PEAK_GAIN, 10 + WebAudioToneHost.ATTACK],
      ['set', WebAudioToneHost.PEAK_GAIN, 10.5],
      ['ramp', 0, 10.5 + WebAudioToneHost.RELEASE]
    ]);
    // Every General MIDI instrument uses the same sine timbre.
    expect(b.type).toBe('sine');
    expect(context.gains[1].gain.events[1][1]).toBeCloseTo(
      WebAudioToneHost.PEAK_GAIN * (64 / 127) ** 2,
      12
    );
    // A tone shorter than two attack periods peaks at its midpoint.
    void host.playTone(tone({ duration: 4 }));
    const [kind, peak, time] = context.gains[2].gain.events[1];
    expect([kind, peak]).toEqual(['ramp', WebAudioToneHost.PEAK_GAIN]);
    expect(time).toBeCloseTo(10.002, 12);
  });
  it('waits exactly the duration, with or without audio, up to the signed 32-bit maximum', async () => {
    for (const context of [new FakeContext(), undefined]) {
      const { host } = setup(context);
      const wait = track(host.playTone(tone({ duration: 300 })));
      await vi.advanceTimersByTimeAsync(299);
      expect(wait.settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(wait.settled).toBe(true);
    }
    const { host } = setup();
    const longest = track(host.playTone(tone({ duration: 2 ** 31 - 1 })));
    await vi.advanceTimersByTimeAsync(2 ** 31 - 2);
    expect(longest.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(longest.settled).toBe(true);
  });
  it('keeps silent tones timed without creating voices', async () => {
    const { context, host } = setup();
    const quiet = track(host.playTone(tone({ volume: 0, duration: 100 })));
    const empty = track(host.playTone(tone({ duration: 0 })));
    expect(context.oscillators).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(empty.settled).toBe(true);
    expect(quiet.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(quiet.settled).toBe(true);
  });
  it('releases every pending wait without silencing sounding tones', async () => {
    const { context, host } = setup();
    const wait = track(host.playTone(tone({ duration: 60000 })));
    host.release();
    await Promise.resolve();
    expect(wait.settled).toBe(true);
    expect(context.oscillators[0].stopped).toEqual([70 + WebAudioToneHost.RELEASE]);
  });
  it('fades out the oldest voice beyond the voice limit', () => {
    const { context, host } = setup();
    for (let i = 0; i <= WebAudioToneHost.MAX_VOICES; i++) void host.playTone(tone());
    const [oldest, next] = context.oscillators;
    expect(oldest.stopped).toEqual([
      10.5 + WebAudioToneHost.RELEASE,
      10 + WebAudioToneHost.RELEASE
    ]);
    expect(context.gains[0].gain.events.slice(-2)).toEqual([
      ['cancel', 10],
      ['target', 0, 10, WebAudioToneHost.ATTACK]
    ]);
    expect(next.stopped).toHaveLength(1);
    // A cut-off voice's later end notice does not count as the last voice ending.
    oldest.onended?.();
    void host.playTone(tone());
    expect(context.oscillators[1].stopped).toHaveLength(2);
  });
  it('creates the context on first need, resumes it in a gesture, and suspends it when idle', async () => {
    const { context, factory, host } = setup();
    expect(factory).not.toHaveBeenCalled();
    context.state = 'suspended';
    host.prepare();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(WebAudioToneHost.IDLE_SUSPEND_DELAY);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    void host.playTone(tone());
    expect(context.resume).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(WebAudioToneHost.IDLE_SUSPEND_DELAY);
    expect(context.suspend).toHaveBeenCalledTimes(1);
    context.oscillators[0].onended?.();
    await vi.advanceTimersByTimeAsync(WebAudioToneHost.IDLE_SUSPEND_DELAY);
    expect(context.suspend).toHaveBeenCalledTimes(2);
    host.prepare();
    expect(factory).toHaveBeenCalledTimes(1);
  });
  it('stays silent but timed when Web Audio is missing, refuses a context, or fails a voice', async () => {
    const failing = new FakeContext();
    failing.createOscillator = () => {
      throw new Error('audio failure');
    };
    for (const host of [
      new WebAudioToneHost(() => {
        throw new Error('blocked');
      }),
      setup(failing).host
    ]) {
      host.prepare();
      const wait = track(host.playTone(tone({ duration: 20 })));
      await vi.advanceTimersByTimeAsync(20);
      expect(wait.settled).toBe(true);
    }
  });
  it('silences voices, releases waits, and closes the context on disposal', async () => {
    const { context, host } = setup();
    const wait = track(host.playTone(tone({ duration: 60000 })));
    host.dispose();
    await Promise.resolve();
    expect(wait.settled).toBe(true);
    expect(context.oscillators[0].stopped.at(-1)).toBeUndefined();
    expect(context.oscillators[0].onended).toBeNull();
    expect(context.close).toHaveBeenCalledTimes(1);
    const later = track(host.playTone(tone()));
    host.prepare();
    await Promise.resolve();
    expect(later.settled).toBe(true);
    expect(context.oscillators).toHaveLength(1);
    host.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
