import type { Tone } from '#lib/engine/syscalls/midi/Tone.js';
import type { ToneGeneratorHost } from '#lib/engine/syscalls/midi/ToneGeneratorHost.js';

/** Audio context operations the tone host uses; tests and browsers without Web Audio supply their own factory. */
export type ToneContext = Pick<
  AudioContext,
  | 'currentTime'
  | 'state'
  | 'destination'
  | 'createOscillator'
  | 'createGain'
  | 'resume'
  | 'suspend'
  | 'close'
>;

type Voice = { readonly oscillator: OscillatorNode; readonly gain: GainNode };

const browserContext = (): ToneContext | undefined =>
  typeof AudioContext === 'function' ? new AudioContext() : undefined;

/** Sine-wave MIDI tone output over Web Audio; each desktop machine owns one instance with its context, voices, and wait timers. */
export class WebAudioToneHost implements ToneGeneratorHost {
  /** Simultaneous voices before the oldest is cut off, bounding a tight loop of asynchronous tones. */
  static readonly MAX_VOICES = 32;
  /** Gain at velocity 127; lower velocities follow the square law of the General MIDI velocity curve. */
  static readonly PEAK_GAIN = 0.2;
  /** Fade-in seconds at note-on, preventing a click. */
  static readonly ATTACK = 0.005;
  /** Fade-out seconds after note-off, preventing a click. */
  static readonly RELEASE = 0.03;
  /** Milliseconds without a sounding voice before the context is suspended to release the audio device. */
  static readonly IDLE_SUSPEND_DELAY = 2000;
  // Undefined until first needed; null when Web Audio is unavailable or the host is disposed.
  private context: ToneContext | null | undefined;
  private readonly voices = new Set<Voice>();
  private readonly waits = new Map<ReturnType<typeof setTimeout>, () => void>();
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  /** Bind the context factory; the default constructs a browser AudioContext only when one is first needed. */
  constructor(private readonly createContext: () => ToneContext | undefined = browserContext) {}
  /** Create or resume the context; call synchronously within the user gesture that starts execution so autoplay policy permits sound. */
  prepare(): void {
    const context = this.open();
    if (!context) return;
    if (context.state !== 'running') void context.resume().catch(() => {});
    if (this.voices.size === 0) this.scheduleIdleSuspend();
  }
  /** Sound one sine tone now and resolve after its duration, whether or not audio is available; the signed 32-bit duration fits the browser timer range. */
  playTone(tone: Tone): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (tone.duration > 0 && tone.volume > 0)
      try {
        this.sound(tone);
      } catch {
        // Like Java's swallowed MIDI exceptions, an audio failure leaves the tone silent but timed.
      }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waits.delete(timer);
        resolve();
      }, tone.duration);
      this.waits.set(timer, resolve);
    });
  }
  /** Resolve every pending wait now, as Stop and Pause require; sounding tones continue to their scheduled end. */
  release(): void {
    for (const [timer, resolve] of this.waits) {
      clearTimeout(timer);
      resolve();
    }
    this.waits.clear();
  }
  /** Release waits, silence every voice, and close the context; later tones are silent and do not wait. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    clearTimeout(this.idleTimer);
    for (const { oscillator, gain } of this.voices) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
  private open(): ToneContext | null {
    if (this.context === undefined && !this.disposed)
      try {
        this.context = this.createContext() ?? null;
      } catch {
        this.context = null;
      }
    return this.context ?? null;
  }
  private sound(tone: Tone): void {
    const context = this.open();
    if (!context || context.state === 'closed') return;
    if (context.state !== 'running') void context.resume().catch(() => {});
    clearTimeout(this.idleTimer);
    const start = context.currentTime;
    while (this.voices.size >= WebAudioToneHost.MAX_VOICES)
      this.cutOff(this.voices.values().next().value!, start);
    const end = start + tone.duration / 1000;
    const peak = WebAudioToneHost.PEAK_GAIN * (tone.volume / 127) ** 2;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 * 2 ** ((tone.pitch - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      peak,
      start + Math.min(WebAudioToneHost.ATTACK, (end - start) / 2)
    );
    gain.gain.setValueAtTime(peak, end);
    gain.gain.linearRampToValueAtTime(0, end + WebAudioToneHost.RELEASE);
    oscillator.connect(gain).connect(context.destination);
    const voice: Voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (this.voices.delete(voice) && this.voices.size === 0) this.scheduleIdleSuspend();
    };
    oscillator.start(start);
    oscillator.stop(end + WebAudioToneHost.RELEASE);
  }
  /** Fade out the oldest voice early to make room for a new one. */
  private cutOff(voice: Voice, now: number): void {
    this.voices.delete(voice);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, WebAudioToneHost.ATTACK);
    voice.oscillator.stop(now + WebAudioToneHost.RELEASE);
  }
  private scheduleIdleSuspend(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      if (this.voices.size === 0 && this.context?.state === 'running')
        void this.context.suspend().catch(() => {});
    }, WebAudioToneHost.IDLE_SUSPEND_DELAY);
  }
}
