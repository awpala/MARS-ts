/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/syscalls/RandomStreams.java; see MARSlicense.txt. */
import { JavaRandom } from './JavaRandom.js';
/** Validate portable stream IDs and internal 48-bit seeds before restoring any state. */
export function isRandomStreamsState(value: unknown): value is [number, number][] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<number>();
  return value.every((entry: unknown) => {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    const [id, seed] = entry;
    if (
      typeof id !== 'number' ||
      (id | 0) !== id ||
      typeof seed !== 'number' ||
      !Number.isSafeInteger(seed) ||
      seed < 0 ||
      seed >= 2 ** 48 ||
      ids.has(id)
    )
      return false;
    ids.add(id);
    return true;
  });
}
/** Session-owned replacement for Java's static stream map; assembly, Reset, and Backstep do not rewind it. */
export class RandomStreams {
  private readonly streams = new Map<number, JavaRandom>();
  /** Bind host entropy for first use of an unseeded stream; explicit seeds never consult it. */
  constructor(private readonly randomSeed: () => bigint) {}
  /** Get or lazily create the stream selected by a signed register value. */
  get(index: number): JavaRandom {
    index |= 0;
    let stream = this.streams.get(index);
    if (!stream) {
      stream = new JavaRandom(this.randomSeed());
      this.streams.set(index, stream);
    }
    return stream;
  }
  /** Seed or reseed a stream without creating a discarded unseeded generator. */
  setSeed(index: number, seed: number): void {
    index |= 0;
    const stream = this.streams.get(index);
    if (stream) stream.setSeed(BigInt(seed | 0));
    else this.streams.set(index, new JavaRandom(BigInt(seed | 0)));
  }
  /** Snapshot all streams in insertion order without mutable references or bigint JSON values. */
  captureState(): [number, number][] {
    return [...this.streams].map(([id, stream]) => [id, stream.captureState()]);
  }
  /** Replace all streams from a validated checkpoint; older checkpoints supply an empty collection. */
  restoreState(state: [number, number][]): void {
    if (!isRandomStreamsState(state)) throw new TypeError('Invalid random stream state');
    this.streams.clear();
    for (const [id, seed] of state) {
      const stream = new JavaRandom(0n);
      stream.restoreState(seed);
      this.streams.set(id, stream);
    }
  }
}
